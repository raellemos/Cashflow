/**
 * Entrypoint de produção (Node/Coolify).
 * dist/server/server.js exporta um fetch handler (WinterCG);
 * srvx faz o bind HTTP. Assets do client são servidos como estáticos.
 */
import { serve } from "srvx";
import { readFile, stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import server from "./dist/server/server.js";

const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "dist", "client");

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".map": "application/json",
};

async function tryStatic(pathname) {
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const file = join(CLIENT_DIR, safe);
  if (!file.startsWith(CLIENT_DIR)) return null;
  try {
    const s = await stat(file);
    if (!s.isFile()) return null;
    const ext = file.slice(file.lastIndexOf("."));
    const immutable = pathname.startsWith("/assets/");
    return new Response(await readFile(file), {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

serve({
  port: PORT,
  fetch: async (request) => {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname !== "/") {
      const staticRes = await tryStatic(pathname);
      if (staticRes) return staticRes;
    }
    const res = await server.fetch(request);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      if (!res.headers.has(k)) res.headers.set(k, v);
    }
    return res;
  },
});

console.log(`[cashflow] servindo em http://0.0.0.0:${PORT}`);
