import { z } from "zod";

/** Centavos: inteiro positivo seguro. */
export const cents = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const centsOrZero = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const uuid = z.string().uuid();
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser YYYY-MM-DD");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------- auth ----------
export const registerSchema = z.object({
  email: z.string().email("E-mail inválido").max(254),
  password: z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
});

// ---------- accounts ----------
export const accountInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["checking", "savings", "credit_card", "wallet"]),
  color: hexColor.default("#D1FF00"),
  initialBalanceCents: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
});

// ---------- categories ----------
export const categoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().min(1).max(8),
  color: hexColor.default("#9C9C9C"),
  kind: z.enum(["expense", "income"]),
});

// ---------- transactions ----------
export const transactionInput = z.object({
  description: z.string().trim().min(1, "Descrição obrigatória").max(200),
  amountCents: cents,
  type: z.enum(["expense", "income"]),
  date: isoDate,
  categoryId: uuid.nullable(),
  accountId: uuid.nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

export const transactionFilter = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  accountId: uuid.optional(),
  categoryId: uuid.optional(),
  limit: z.number().int().min(1).max(1000).default(500),
  offset: z.number().int().min(0).default(0),
});

// ---------- budgets ----------
export const budgetInput = z.object({
  categoryId: uuid,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  amountCents: cents,
});

// ---------- goals ----------
export const goalInput = z.object({
  title: z.string().trim().min(1).max(120),
  targetAmountCents: cents,
  currentAmountCents: centsOrZero.default(0),
  deadline: isoDate.nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

// ---------- credit scores ----------
export const creditScoreInput = z.object({
  score: z.number().int().min(0).max(1000),
  recordedAt: isoDate,
  notes: z.string().trim().max(500).nullable(),
});

// ---------- action plans ----------
export const actionPlanInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable(),
  dueDate: isoDate.nullable(),
  status: z.enum(["pending", "done"]).default("pending"),
  amountCents: cents.nullable(),
  creditor: z.string().trim().max(120).nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AccountInput = z.infer<typeof accountInput>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type TransactionInput = z.infer<typeof transactionInput>;
export type TransactionFilter = z.infer<typeof transactionFilter>;
export type BudgetInput = z.infer<typeof budgetInput>;
export type GoalInput = z.infer<typeof goalInput>;
export type CreditScoreInput = z.infer<typeof creditScoreInput>;
export type ActionPlanInput = z.infer<typeof actionPlanInput>;
