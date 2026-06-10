/**
 * Server functions de dados. Toda função:
 * 1. exige sessão (requireUser)
 * 2. valida entrada com Zod
 * 3. filtra por user_id no WHERE (isolamento — substituto do RLS)
 * Dinheiro: SEMPRE *_cents (inteiro).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  accountInput,
  actionPlanInput,
  budgetInput,
  categoryInput,
  creditScoreInput,
  goalInput,
  transactionFilter,
  transactionInput,
  uuid,
} from "@/lib/schemas";
import { query } from "./db";
import { requireUser } from "./session";

const idOnly = z.object({ id: uuid });

// ============ TRANSACTIONS ============

export type TxRow = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  type: "expense" | "income";
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
};

export const listTransactions = createServerFn({ method: "GET" })
  .validator(transactionFilter)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const where: string[] = ["user_id = $1"];
    const params: unknown[] = [user.id];
    if (data.from) {
      params.push(data.from);
      where.push(`date >= $${params.length}`);
    }
    if (data.to) {
      params.push(data.to);
      where.push(`date <= $${params.length}`);
    }
    if (data.accountId) {
      params.push(data.accountId);
      where.push(`account_id = $${params.length}`);
    }
    if (data.categoryId) {
      params.push(data.categoryId);
      where.push(`category_id = $${params.length}`);
    }
    params.push(data.limit, data.offset);
    return query<TxRow>(
      `SELECT id, date, description, amount_cents, type, category_id, account_id, notes
       FROM transactions WHERE ${where.join(" AND ")}
       ORDER BY date DESC, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
  });

export const createTransaction = createServerFn({ method: "POST" })
  .validator(transactionInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<TxRow>(
      `INSERT INTO transactions (user_id, description, amount_cents, type, date, category_id, account_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, date, description, amount_cents, type, category_id, account_id, notes`,
      [
        user.id,
        data.description,
        data.amountCents,
        data.type,
        data.date,
        data.categoryId,
        data.accountId,
        data.notes,
      ],
    );
    return rows[0];
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuid, data: transactionInput }))
  .handler(async ({ data: { id, data } }) => {
    const user = await requireUser();
    const rows = await query<TxRow>(
      `UPDATE transactions SET description=$3, amount_cents=$4, type=$5, date=$6, category_id=$7, account_id=$8, notes=$9
       WHERE id = $1 AND user_id = $2
       RETURNING id, date, description, amount_cents, type, category_id, account_id, notes`,
      [
        id,
        user.id,
        data.description,
        data.amountCents,
        data.type,
        data.date,
        data.categoryId,
        data.accountId,
        data.notes,
      ],
    );
    if (rows.length === 0) throw new Error("Transação não encontrada");
    return rows[0];
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM transactions WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ ACCOUNTS ============

export type AccountRow = {
  id: string;
  name: string;
  type: string;
  color: string;
  initial_balance_cents: number;
};

export const listAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return query<AccountRow>(
    "SELECT id, name, type, color, initial_balance_cents FROM accounts WHERE user_id = $1 ORDER BY created_at",
    [user.id],
  );
});

export const createAccount = createServerFn({ method: "POST" })
  .validator(accountInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<AccountRow>(
      `INSERT INTO accounts (user_id, name, type, color, initial_balance_cents)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, type, color, initial_balance_cents`,
      [user.id, data.name, data.type, data.color, data.initialBalanceCents],
    );
    return rows[0];
  });

export const updateAccount = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuid, data: accountInput }))
  .handler(async ({ data: { id, data } }) => {
    const user = await requireUser();
    const rows = await query<AccountRow>(
      `UPDATE accounts SET name=$3, type=$4, color=$5, initial_balance_cents=$6
       WHERE id = $1 AND user_id = $2 RETURNING id, name, type, color, initial_balance_cents`,
      [id, user.id, data.name, data.type, data.color, data.initialBalanceCents],
    );
    if (rows.length === 0) throw new Error("Conta não encontrada");
    return rows[0];
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM accounts WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ CATEGORIES ============

export type CategoryRow = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: "expense" | "income";
};

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return query<CategoryRow>(
    "SELECT id, name, emoji, color, kind FROM categories WHERE user_id = $1 ORDER BY name",
    [user.id],
  );
});

export const createCategory = createServerFn({ method: "POST" })
  .validator(categoryInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<CategoryRow>(
      `INSERT INTO categories (user_id, name, emoji, color, kind)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, name, emoji, color, kind`,
      [user.id, data.name, data.emoji, data.color, data.kind],
    );
    return rows[0];
  });

export const updateCategory = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuid, data: categoryInput }))
  .handler(async ({ data: { id, data } }) => {
    const user = await requireUser();
    const rows = await query<CategoryRow>(
      `UPDATE categories SET name=$3, emoji=$4, color=$5, kind=$6
       WHERE id = $1 AND user_id = $2 RETURNING id, name, emoji, color, kind`,
      [id, user.id, data.name, data.emoji, data.color, data.kind],
    );
    if (rows.length === 0) throw new Error("Categoria não encontrada");
    return rows[0];
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM categories WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ BUDGETS ============

export type BudgetRow = {
  id: string;
  category_id: string;
  month: number;
  year: number;
  amount_cents: number;
};

export const listBudgets = createServerFn({ method: "GET" })
  .validator(z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }))
  .handler(async ({ data }) => {
    const user = await requireUser();
    return query<BudgetRow>(
      "SELECT id, category_id, month, year, amount_cents FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3",
      [user.id, data.month, data.year],
    );
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .validator(budgetInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<BudgetRow>(
      `INSERT INTO budgets (user_id, category_id, month, year, amount_cents)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, category_id, month, year) DO UPDATE SET amount_cents = EXCLUDED.amount_cents
       RETURNING id, category_id, month, year, amount_cents`,
      [user.id, data.categoryId, data.month, data.year, data.amountCents],
    );
    return rows[0];
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM budgets WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ GOALS ============

export type GoalRow = {
  id: string;
  title: string;
  target_amount_cents: number;
  current_amount_cents: number;
  deadline: string | null;
  notes: string | null;
};

export const listGoals = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return query<GoalRow>(
    `SELECT id, title, target_amount_cents, current_amount_cents, deadline, notes
     FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id],
  );
});

export const createGoal = createServerFn({ method: "POST" })
  .validator(goalInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<GoalRow>(
      `INSERT INTO goals (user_id, title, target_amount_cents, current_amount_cents, deadline, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, title, target_amount_cents, current_amount_cents, deadline, notes`,
      [
        user.id,
        data.title,
        data.targetAmountCents,
        data.currentAmountCents,
        data.deadline,
        data.notes,
      ],
    );
    return rows[0];
  });

export const updateGoal = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuid, data: goalInput }))
  .handler(async ({ data: { id, data } }) => {
    const user = await requireUser();
    const rows = await query<GoalRow>(
      `UPDATE goals SET title=$3, target_amount_cents=$4, current_amount_cents=$5, deadline=$6, notes=$7
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, target_amount_cents, current_amount_cents, deadline, notes`,
      [
        id,
        user.id,
        data.title,
        data.targetAmountCents,
        data.currentAmountCents,
        data.deadline,
        data.notes,
      ],
    );
    if (rows.length === 0) throw new Error("Meta não encontrada");
    return rows[0];
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM goals WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ CREDIT SCORES ============

export type CreditScoreRow = {
  id: string;
  score: number;
  recorded_at: string;
  notes: string | null;
};

export const listCreditScores = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return query<CreditScoreRow>(
    "SELECT id, score, recorded_at, notes FROM credit_scores WHERE user_id = $1 ORDER BY recorded_at DESC",
    [user.id],
  );
});

export const createCreditScore = createServerFn({ method: "POST" })
  .validator(creditScoreInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<CreditScoreRow>(
      `INSERT INTO credit_scores (user_id, score, recorded_at, notes)
       VALUES ($1,$2,$3,$4) RETURNING id, score, recorded_at, notes`,
      [user.id, data.score, data.recordedAt, data.notes],
    );
    return rows[0];
  });

export const deleteCreditScore = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM credit_scores WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });

// ============ ACTION PLANS ============

export type ActionPlanRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "done";
  amount_cents: number | null;
  creditor: string | null;
};

export const listActionPlans = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return query<ActionPlanRow>(
    `SELECT id, title, description, due_date, status, amount_cents, creditor
     FROM action_plans WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.id],
  );
});

export const createActionPlan = createServerFn({ method: "POST" })
  .validator(actionPlanInput)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const rows = await query<ActionPlanRow>(
      `INSERT INTO action_plans (user_id, title, description, due_date, status, amount_cents, creditor)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, description, due_date, status, amount_cents, creditor`,
      [
        user.id,
        data.title,
        data.description,
        data.dueDate,
        data.status,
        data.amountCents,
        data.creditor,
      ],
    );
    return rows[0];
  });

export const updateActionPlan = createServerFn({ method: "POST" })
  .validator(z.object({ id: uuid, data: actionPlanInput }))
  .handler(async ({ data: { id, data } }) => {
    const user = await requireUser();
    const rows = await query<ActionPlanRow>(
      `UPDATE action_plans SET title=$3, description=$4, due_date=$5, status=$6, amount_cents=$7, creditor=$8
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, description, due_date, status, amount_cents, creditor`,
      [
        id,
        user.id,
        data.title,
        data.description,
        data.dueDate,
        data.status,
        data.amountCents,
        data.creditor,
      ],
    );
    if (rows.length === 0) throw new Error("Plano não encontrado");
    return rows[0];
  });

export const deleteActionPlan = createServerFn({ method: "POST" })
  .validator(idOnly)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await query("DELETE FROM action_plans WHERE id = $1 AND user_id = $2", [data.id, user.id]);
    return { ok: true };
  });
