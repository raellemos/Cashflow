/**
 * Migra os dados do Supabase (projeto Lovable) para o Postgres da VPS.
 *
 * Uso (na sua máquina, com acesso ao Supabase):
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_ANON_KEY=... \
 *   SUPABASE_EMAIL=seu@email.com \
 *   SUPABASE_PASSWORD=sua_senha \
 *   NEW_PASSWORD=senha_nova_min_8 \
 *   npx tsx scripts/migrate-from-supabase.ts > scripts/dump.sql
 *
 * Depois, na VPS:
 *   docker exec -i postgres-totum psql -U cashflow_app -d cashflow < scripts/dump.sql
 *
 * Conversões aplicadas:
 *   - NUMERIC(14,2) → centavos inteiros (Math.round(x * 100))
 *   - auth.users + profiles → users (UUID preservado, senha = NEW_PASSWORD com argon2)
 *   - UUIDs de todas as entidades preservados (FKs continuam válidas)
 */
import { hash } from "@node-rs/argon2";

const env = (k: string): string => {
  const v = process.env[k];
  if (!v) {
    console.error(`-- ERRO: variável ${k} não definida`);
    process.exit(1);
  }
  return v;
};

const SUPABASE_URL = env("SUPABASE_URL").replace(/\/$/, "");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const EMAIL = env("SUPABASE_EMAIL");
const PASSWORD = env("SUPABASE_PASSWORD");
const NEW_PASSWORD = env("NEW_PASSWORD");

if (NEW_PASSWORD.length < 8) {
  console.error("-- ERRO: NEW_PASSWORD precisa de no mínimo 8 caracteres");
  process.exit(1);
}

const toCents = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Valor monetário inválido: ${v}`);
  return Math.round(n * 100);
};

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

async function login(): Promise<{ accessToken: string; userId: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login falhou: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; user: { id: string } };
  return { accessToken: json.access_token, userId: json.user.id };
}

async function fetchAll(table: string, token: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

async function main() {
  const { accessToken, userId } = await login();

  const [profiles, accounts, categories, transactions, budgets, goals, scores, plans] =
    await Promise.all([
      fetchAll("profiles", accessToken),
      fetchAll("accounts", accessToken),
      fetchAll("categories", accessToken),
      fetchAll("transactions", accessToken),
      fetchAll("budgets", accessToken),
      fetchAll("goals", accessToken),
      fetchAll("credit_scores", accessToken),
      fetchAll("action_plans", accessToken),
    ]);

  const profile = profiles.find((p) => p.id === userId);
  const passwordHash = await hash(NEW_PASSWORD, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const lines: string[] = ["BEGIN;", ""];

  lines.push(
    `INSERT INTO users (id, email, password_hash, display_name) VALUES (${q(userId)}, ${q(EMAIL.toLowerCase())}, ${q(passwordHash)}, ${q(profile?.display_name ?? null)});`,
    "",
  );

  for (const a of accounts) {
    lines.push(
      `INSERT INTO accounts (id, user_id, name, type, color, initial_balance_cents, created_at) VALUES (${q(a.id)}, ${q(a.user_id)}, ${q(a.name)}, ${q(a.type)}, ${q(a.color)}, ${toCents(a.initial_balance)}, ${q(a.created_at)});`,
    );
  }
  lines.push("");

  for (const c of categories) {
    lines.push(
      `INSERT INTO categories (id, user_id, name, emoji, color, kind, created_at) VALUES (${q(c.id)}, ${q(c.user_id)}, ${q(c.name)}, ${q(c.emoji)}, ${q(c.color)}, ${q(c.kind)}, ${q(c.created_at)});`,
    );
  }
  lines.push("");

  for (const t of transactions) {
    lines.push(
      `INSERT INTO transactions (id, user_id, account_id, category_id, description, amount_cents, type, date, notes, created_at) VALUES (${q(t.id)}, ${q(t.user_id)}, ${q(t.account_id)}, ${q(t.category_id)}, ${q(t.description)}, ${toCents(t.amount)}, ${q(t.type)}, ${q(t.date)}, ${q(t.notes)}, ${q(t.created_at)});`,
    );
  }
  lines.push("");

  for (const b of budgets) {
    lines.push(
      `INSERT INTO budgets (id, user_id, category_id, month, year, amount_cents, created_at) VALUES (${q(b.id)}, ${q(b.user_id)}, ${q(b.category_id)}, ${q(b.month)}, ${q(b.year)}, ${toCents(b.amount)}, ${q(b.created_at)});`,
    );
  }
  lines.push("");

  for (const g of goals) {
    lines.push(
      `INSERT INTO goals (id, user_id, title, target_amount_cents, current_amount_cents, deadline, notes, created_at) VALUES (${q(g.id)}, ${q(g.user_id)}, ${q(g.title)}, ${toCents(g.target_amount)}, ${toCents(g.current_amount) ?? 0}, ${q(g.deadline)}, ${q(g.notes)}, ${q(g.created_at)});`,
    );
  }
  lines.push("");

  for (const s of scores) {
    lines.push(
      `INSERT INTO credit_scores (id, user_id, score, recorded_at, notes, created_at) VALUES (${q(s.id)}, ${q(s.user_id)}, ${q(s.score)}, ${q(s.recorded_at)}, ${q(s.notes)}, ${q(s.created_at)});`,
    );
  }
  lines.push("");

  for (const p of plans) {
    lines.push(
      `INSERT INTO action_plans (id, user_id, title, description, due_date, status, amount_cents, creditor, created_at) VALUES (${q(p.id)}, ${q(p.user_id)}, ${q(p.title)}, ${q(p.description)}, ${q(p.due_date)}, ${q(p.status)}, ${toCents(p.amount)}, ${q(p.creditor)}, ${q(p.created_at)});`,
    );
  }

  lines.push("", "COMMIT;");
  lines.push(
    `-- Resumo: 1 user, ${accounts.length} accounts, ${categories.length} categories, ${transactions.length} transactions, ${budgets.length} budgets, ${goals.length} goals, ${scores.length} scores, ${plans.length} action_plans`,
  );

  console.log(lines.join("\n"));
}

main().catch((e) => {
  console.error(`-- ERRO: ${e.message}`);
  process.exit(1);
});
