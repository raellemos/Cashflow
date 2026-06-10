import { SignJWT, jwtVerify } from "jose";
import { clearSessionCookie, readSessionCookie, writeSessionCookie } from "./http";

const SESSION_DAYS = 7;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "JWT_SECRET ausente ou curto demais (mínimo 32 chars). Gere: openssl rand -hex 32",
    );
  }
  return new TextEncoder().encode(s);
}

export type SessionUser = { id: string; email: string };

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  writeSessionCookie(token, SESSION_DAYS * 24 * 60 * 60);
}

export function destroySession(): void {
  clearSessionCookie();
}

/** Retorna o usuário da sessão ou null. Nunca lança. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = readSessionCookie();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** Para server functions protegidas: retorna userId ou lança 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
