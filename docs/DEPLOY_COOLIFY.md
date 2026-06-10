# Deploy do Cashflow na VPS via Coolify

> Backend próprio (TanStack Start server functions + Postgres `postgres-totum`).
> Zero Supabase. Dinheiro em centavos inteiros (BIGINT).

## Arquitetura

```
Browser ──HTTPS (cloudflared tunnel)──▶ Coolify app (Node :3000)
                                          │ server functions (auth JWT httpOnly + CRUD)
                                          ▼
                                   postgres-totum (database: cashflow)
```

Uma única aplicação: o servidor Node do TanStack Start serve o frontend
e executa as server functions (não há API separada nem CORS).

---

## Passo 1 — Criar database no postgres-totum (~3 min, uma vez)

```bash
# Gerar senha forte:
openssl rand -hex 24

# Editar db/setup/01_create_db.sql trocando TROCAR_ESTA_SENHA, então:
docker cp db/setup/01_create_db.sql postgres-totum:/tmp/
docker exec -it postgres-totum psql -U postgres -f /tmp/01_create_db.sql

# Aplicar o schema:
docker exec -i postgres-totum psql -U cashflow_app -d cashflow < db/migrations/0001_init.sql
```

## Passo 2 — Cadastrar app no Coolify (~10 min, uma vez)

1. Coolify → **New Resource → Application → GitHub** → repo `raellemos/Cashflow`, branch `main` (após merge da `feat/vps-backend`)
2. Build pack: **Dockerfile** (já está na raiz)
3. Porta: **3000**
4. **Environment variables:**
   - `DATABASE_URL` = `postgres://cashflow_app:SENHA@postgres-totum:5432/cashflow`
   - `JWT_SECRET` = saída de `openssl rand -hex 32`
   - `NODE_ENV` = `production`
5. **Rede:** conectar o app à mesma docker network do `postgres-totum`
   (Coolify → app → Advanced → Network; ou `docker network connect <rede_do_postgres> <container_do_app>`)
6. Deploy. A partir daqui, **todo push na branch main deploya sozinho** (configure o webhook do GitHub que o Coolify mostra na tela do app).

## Passo 3 — Expor no tunnel cloudflared (~3 min)

Adicionar ingress no config do cloudflared (NÃO derrubar o tunnel — D-028):

```yaml
# /etc/cloudflared/config.yml (ou ~/.cloudflared/config.yml)
ingress:
  - hostname: cashflow.SEU-DOMINIO.com   # defina o subdomínio
    service: http://localhost:PORTA_DO_APP_NO_COOLIFY
  # ... demais regras existentes ...
```

```bash
cloudflared tunnel route dns <TUNNEL> cashflow.SEU-DOMINIO.com
sudo systemctl reload cloudflared   # reload, não restart
curl -I https://cashflow.SEU-DOMINIO.com   # esperado: 200
```

## Passo 4 — Migrar os dados do Supabase (~5 min, uma vez)

Na sua máquina (precisa do seu login do app antigo):

```bash
cd Cashflow
SUPABASE_URL=https://SEU_PROJETO.supabase.co \
SUPABASE_ANON_KEY=... \
SUPABASE_EMAIL=seu@email.com \
SUPABASE_PASSWORD=sua_senha_atual \
NEW_PASSWORD=senha_nova_para_o_cashflow_self_hosted \
npx tsx scripts/migrate-from-supabase.ts > scripts/dump.sql

# Conferir o resumo no fim do arquivo, então enviar à VPS:
scp scripts/dump.sql totum@VPS:/tmp/
ssh totum@VPS 'docker exec -i postgres-totum psql -U cashflow_app -d cashflow < /tmp/dump.sql && rm /tmp/dump.sql'
rm scripts/dump.sql   # contém seus dados financeiros — não deixar parado
```

Login no app novo: mesmo e-mail + `NEW_PASSWORD`.

## Passo 5 — Backup (OBRIGATÓRIO para dado financeiro)

Incluir o database `cashflow` no pgbackrest já configurado
(ver `PGBACKREST_SETUP_2026-06.md` na pasta vps-totum). Validar com um
restore de teste antes de desativar o projeto Supabase.

## Passo 6 — Desativar o Supabase (somente após validar tudo)

1. Usar o app novo por alguns dias em paralelo
2. Conferir saldos/contagens contra o app antigo
3. Pausar/deletar o projeto no dashboard do Supabase

---

## Variáveis de ambiente (resumo)

| Var | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | `postgres://cashflow_app:senha@postgres-totum:5432/cashflow` |
| `JWT_SECRET` | sim | ≥32 chars — `openssl rand -hex 32` |
| `NODE_ENV` | sim | `production` |

## Decisões técnicas registradas

- **Dinheiro:** centavos inteiros (BIGINT no DB, int no TS). Parser BR aceita "1.234,56".
- **Auth:** JWT HS256 próprio em cookie httpOnly/sameSite=lax, sessão 7d, argon2id (OWASP), rate limit 5 tentativas/15min no login.
- **Isolamento:** sem RLS — toda query filtra `user_id` da sessão; usuário do banco só enxerga o database `cashflow`.
- **Validação:** Zod em todas as server functions + CHECKs no Postgres.
- **Reset de senha por e-mail:** pendente de SMTP (TODO em `src/routes/recuperar-senha.tsx`).
