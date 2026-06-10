/**
 * Adapter fino sobre a API HTTP do TanStack Start.
 * Isola leitura/escrita de cookie de sessão — se a API do Start mudar,
 * só este arquivo é tocado.
 */
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

export const SESSION_COOKIE = "cf_session";

const isProd = process.env.NODE_ENV === "production";

export function readSessionCookie(): string | undefined {
  return getCookie(SESSION_COOKIE);
}

export function writeSessionCookie(token: string, maxAgeSeconds: number): void {
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}
