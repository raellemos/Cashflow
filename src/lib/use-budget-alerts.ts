import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export type BudgetAlertLevel = "warning" | "critical" | "over";

export type BudgetAlert = {
  categoryId: string;
  categoryName: string;
  emoji: string;
  color: string;
  budget: number;
  spent: number;
  pct: number;
  level: BudgetAlertLevel;
};

type CategoryRow = { id: string; name: string; emoji: string; color: string };
type BudgetRow = { category_id: string; amount: number };
type SpentRow = { category_id: string | null; amount: number };

const WARNING_THRESHOLD = 80; // %
const CRITICAL_THRESHOLD = 100; // %

function levelFor(pct: number): BudgetAlertLevel | null {
  if (pct >= 110) return "over";
  if (pct >= CRITICAL_THRESHOLD) return "critical";
  if (pct >= WARNING_THRESHOLD) return "warning";
  return null;
}

/**
 * Retorna alertas de orçamento para o mês corrente e dispara toasts
 * de aviso (80%) / crítico (100%) uma única vez por sessão + categoria + nível.
 */
export function useBudgetAlerts(options?: { silent?: boolean }) {
  const { user } = useAuth();
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,emoji,color")
        .eq("kind", "expense");
      if (error) throw error;
      return (data ?? []) as CategoryRow[];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budget-alerts-budgets", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("category_id,amount")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as BudgetRow[];
    },
  });

  const { data: spent = [] } = useQuery({
    queryKey: ["budget-alerts-spent", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id,amount")
        .gte("date", start)
        .lte("date", end)
        .eq("type", "expense");
      if (error) throw error;
      return (data ?? []) as SpentRow[];
    },
  });

  const alerts = useMemo<BudgetAlert[]>(() => {
    if (!cats.length || !budgets.length) return [];
    const catMap = new Map(cats.map((c) => [c.id, c]));
    const spentMap = new Map<string, number>();
    spent.forEach((t) => {
      if (!t.category_id) return;
      spentMap.set(t.category_id, (spentMap.get(t.category_id) ?? 0) + Number(t.amount));
    });

    const out: BudgetAlert[] = [];
    for (const b of budgets) {
      const cat = catMap.get(b.category_id);
      if (!cat) continue;
      const budget = Number(b.amount);
      if (budget <= 0) continue;
      const s = spentMap.get(b.category_id) ?? 0;
      const pct = (s / budget) * 100;
      const lvl = levelFor(pct);
      if (!lvl) continue;
      out.push({
        categoryId: cat.id,
        categoryName: cat.name,
        emoji: cat.emoji,
        color: cat.color,
        budget,
        spent: s,
        pct,
        level: lvl,
      });
    }
    // Ordena por severidade (over → critical → warning) e depois % desc
    const rank: Record<BudgetAlertLevel, number> = { over: 3, critical: 2, warning: 1 };
    return out.sort((a, b) => rank[b.level] - rank[a.level] || b.pct - a.pct);
  }, [cats, budgets, spent]);

  // Dispara toasts uma vez por sessão + categoria + nível
  useEffect(() => {
    if (options?.silent) return;
    if (typeof window === "undefined") return;
    if (!user || !alerts.length) return;

    const storageKey = `budget-alerts:${user.id}:${year}-${month}`;
    let seen: Record<string, true> = {};
    try {
      seen = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    } catch {
      seen = {};
    }

    let mutated = false;
    for (const a of alerts) {
      const key = `${a.categoryId}:${a.level}`;
      if (seen[key]) continue;
      seen[key] = true;
      mutated = true;
      const pctStr = `${a.pct.toFixed(0)}%`;
      if (a.level === "warning") {
        toast.warning(`${a.emoji} ${a.categoryName} · ${pctStr} do orçamento`, {
          description: `Já gastou ${brl(a.spent)} de ${brl(a.budget)} este mês.`,
        });
      } else if (a.level === "critical") {
        toast.error(`${a.emoji} ${a.categoryName} · orçamento atingido`, {
          description: `100% do limite (${brl(a.budget)}) consumido.`,
        });
      } else {
        toast.error(`${a.emoji} ${a.categoryName} · orçamento estourado`, {
          description: `Gastou ${brl(a.spent)} — ${pctStr} do limite de ${brl(a.budget)}.`,
        });
      }
    }
    if (mutated) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(seen));
      } catch {
        /* ignore */
      }
    }
  }, [alerts, user, month, year, options?.silent]);

  return { alerts, month, year };
}

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
