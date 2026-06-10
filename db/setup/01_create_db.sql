-- ============================================================
-- Rodar UMA VEZ no postgres-totum como superusuário (postgres).
-- Ex.: docker exec -it postgres-totum psql -U postgres -f /tmp/01_create_db.sql
-- TROQUE A SENHA antes de rodar (openssl rand -hex 24).
-- ============================================================

CREATE USER cashflow_app WITH PASSWORD 'TROCAR_ESTA_SENHA' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE cashflow OWNER cashflow_app;

-- Conectar no database novo e restringir o schema public:
\connect cashflow
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO cashflow_app;

-- Depois, aplicar a migration como cashflow_app:
-- docker exec -i postgres-totum psql -U cashflow_app -d cashflow < db/migrations/0001_init.sql
