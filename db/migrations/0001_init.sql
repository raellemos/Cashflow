-- ============================================================
-- Cashflow — schema inicial (Postgres self-hosted, VPS Totum)
-- Dinheiro: SEMPRE centavos inteiros (BIGINT). Nunca NUMERIC/float.
-- Sem RLS: acesso exclusivo via API (usuário cashflow_app é dono
-- apenas deste database). Isolamento por user_id no WHERE da API.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid

-- ---------- users (substitui auth.users + profiles) ----------
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- accounts ----------
CREATE TABLE accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'checking'
                        CHECK (type IN ('checking','savings','credit_card','wallet')),
  color                 TEXT NOT NULL DEFAULT '#D1FF00',
  initial_balance_cents BIGINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_user ON accounts(user_id);

-- ---------- categories ----------
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '💸',
  color      TEXT NOT NULL DEFAULT '#9C9C9C',
  kind       TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','income')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_user ON categories(user_id);

-- ---------- transactions ----------
CREATE TABLE transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id   UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  type         TEXT NOT NULL DEFAULT 'expense' CHECK (type IN ('expense','income')),
  date         DATE NOT NULL DEFAULT CURRENT_DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);

-- ---------- budgets ----------
CREATE TABLE budgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month        INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year         INT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, category_id, month, year)
);
CREATE INDEX idx_budgets_user_period ON budgets(user_id, year, month);

-- ---------- goals ----------
CREATE TABLE goals (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  target_amount_cents  BIGINT NOT NULL CHECK (target_amount_cents > 0),
  current_amount_cents BIGINT NOT NULL DEFAULT 0 CHECK (current_amount_cents >= 0),
  deadline             DATE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_user ON goals(user_id);

-- ---------- credit_scores ----------
CREATE TABLE credit_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score       INT NOT NULL CHECK (score BETWEEN 0 AND 1000),
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_scores_user ON credit_scores(user_id, recorded_at DESC);

-- ---------- action_plans ----------
CREATE TABLE action_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  amount_cents BIGINT CHECK (amount_cents IS NULL OR amount_cents > 0),
  creditor     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_action_plans_user ON action_plans(user_id);

-- ---------- updated_at trigger ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_accounts_updated     BEFORE UPDATE ON accounts     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_goals_updated        BEFORE UPDATE ON goals        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_action_plans_updated BEFORE UPDATE ON action_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Controle de migrations aplicadas
CREATE TABLE _migrations (
  name       TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO _migrations (name) VALUES ('0001_init');

COMMIT;
