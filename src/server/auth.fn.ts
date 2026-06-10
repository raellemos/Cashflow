import { createServerFn } from "@tanstack/react-start";
import { hash, verify } from "@node-rs/argon2";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@/lib/schemas";
import { query, withTransaction } from "./db";
import { createSession, destroySession, getSessionUser, requireUser } from "./session";

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP 2024 baseline

// ---------- rate limit de login (memória; suficiente para single-instance) ----------
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(email: string): void {
  const now = Date.now();
  const slot = attempts.get(email);
  if (!slot || now > slot.resetAt) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  slot.count++;
  if (slot.count > MAX_ATTEMPTS) {
    throw new Error("Muitas tentativas. Aguarde 15 minutos.");
  }
}

// ---------- seeds de novo usuário (espelha o antigo handle_new_user do Supabase) ----------
const DEFAULT_ACCOUNTS: Array<[string, string, string]> = [
  ["Conta Corrente", "checking", "#D1FF00"],
  ["Carteira", "wallet", "#0099FF"],
  ["Cartão de Crédito", "credit_card", "#ED4609"],
];

const DEFAULT_CATEGORIES: Array<[string, string, string, string]> = [
  ["Alimentação", "🍔", "#ED4609", "expense"],
  ["Transporte", "🚗", "#0099FF", "expense"],
  ["Moradia", "🏠", "#9C9C9C", "expense"],
  ["Assinaturas", "📱", "#D1FF00", "expense"],
  ["Saúde", "💊", "#ED4609", "expense"],
  ["Lazer", "🎮", "#0099FF", "expense"],
  ["Educação", "📚", "#D1FF00", "expense"],
  ["Compras", "🛍️", "#9C9C9C", "expense"],
  ["Cartão de Crédito", "💳", "#ED4609", "expense"],
  ["Outros", "💸", "#9C9C9C", "expense"],
  ["Salário", "💰", "#D1FF00", "income"],
  ["Freelance", "💼", "#D1FF00", "income"],
  ["Rendimentos", "📈", "#0099FF", "income"],
];

// ---------- server functions ----------

export const register = createServerFn({ method: "POST" })
  .validator(registerSchema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    const existing = await query("SELECT 1 FROM users WHERE email = $1", [email]);
    if (existing.length > 0) throw new Error("E-mail já cadastrado");

    const passwordHash = await hash(data.password, ARGON2_OPTS);
    const displayName = data.displayName ?? email.split("@")[0];

    const user = await withTransaction(async (q) => {
      const rows = await q(
        "INSERT INTO users (email, password_hash, display_name) VALUES ($1,$2,$3) RETURNING id, email",
        [email, passwordHash, displayName],
      );
      const u = rows[0] as { id: string; email: string };
      for (const [name, type, color] of DEFAULT_ACCOUNTS) {
        await q(
          "INSERT INTO accounts (user_id, name, type, color, initial_balance_cents) VALUES ($1,$2,$3,$4,0)",
          [u.id, name, type, color],
        );
      }
      for (const [name, emoji, color, kind] of DEFAULT_CATEGORIES) {
        await q(
          "INSERT INTO categories (user_id, name, emoji, color, kind) VALUES ($1,$2,$3,$4,$5)",
          [u.id, name, emoji, color, kind],
        );
      }
      return u;
    });

    await createSession({ id: user.id, email: user.email });
    return { id: user.id, email: user.email, displayName };
  });

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase().trim();
    checkRateLimit(email);
    const rows = await query<{
      id: string;
      email: string;
      password_hash: string;
      display_name: string | null;
    }>("SELECT id, email, password_hash, display_name FROM users WHERE email = $1", [email]);
    // Mensagem idêntica para usuário inexistente e senha errada (anti-enumeração)
    const fail = () => new Error("E-mail ou senha incorretos");
    if (rows.length === 0) throw fail();
    const ok = await verify(rows[0].password_hash, data.password);
    if (!ok) throw fail();
    attempts.delete(email);
    await createSession({ id: rows[0].id, email: rows[0].email });
    return { id: rows[0].id, email: rows[0].email, displayName: rows[0].display_name };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  destroySession();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getSessionUser();
  if (!session) return null;
  const rows = await query<{
    id: string;
    email: string;
    display_name: string | null;
    created_at: string;
  }>("SELECT id, email, display_name, created_at FROM users WHERE id = $1", [session.id]);
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    displayName: rows[0].display_name,
    createdAt: rows[0].created_at,
  };
});

export const updateProfile = createServerFn({ method: "POST" })
  .validator(updateProfileSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("UPDATE users SET display_name = $1 WHERE id = $2", [data.displayName, user.id]);
    return { ok: true };
  });

export const changePassword = createServerFn({ method: "POST" })
  .validator(changePasswordSchema)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [user.id],
    );
    const ok = await verify(rows[0].password_hash, data.currentPassword);
    if (!ok) throw new Error("Senha atual incorreta");
    const newHash = await hash(data.newPassword, ARGON2_OPTS);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, user.id]);
    return { ok: true };
  });
