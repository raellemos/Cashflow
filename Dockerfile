# ============================================================
# Cashflow — container Node para Coolify (VPS Totum)
# Build: vite build (TanStack Start) → dist/server/server.js
# ============================================================

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Output do TanStack Start é self-contained (deps bundladas)
COPY --from=build /app/dist ./dist
# node-rs/argon2 e pg são nativos/externos — garantir node_modules de produção
COPY --from=build /app/node_modules ./node_modules
COPY package.json server-entry.mjs ./

EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
CMD ["node", "server-entry.mjs"]
