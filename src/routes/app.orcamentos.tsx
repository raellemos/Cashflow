import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { brl, monthLabel } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { KpiTile } from "@/components/kpi-tile";
import { ExportMenu } from "@/components/export-menu";
import { exportCSV, exportPDF } from "@/lib/export";
import { Plus, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — CashFlow" }] }),
  component: BudgetsPage,
});

type Category = { id: string; name: string; emoji: string; color: string; kind: string };
type Budget = { id: string; category_id: string; month: number; year: number; amount: number };

function BudgetsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").eq("kind", "expense");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });

  const { data: spent = [] } = useQuery({
    queryKey: ["spent", user?.id, month, year],
    enabled: !!user,
    queryFn: async () => {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const endD = new Date(year, month, 0);
      const end = `${year}-${String(month).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("transactions")
        .select("category_id,amount,type")
        .gte("date", start)
        .lte("date", end)
        .eq("type", "expense");
      if (error) throw error;
      return (data ?? []) as { category_id: string | null; amount: number; type: string }[];
    },
  });

  const spentMap = useMemo(() => {
    const m = new Map<string, number>();
    spent.forEach((t) => {
      if (!t.category_id) return;
      m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount));
    });
    return m;
  }, [spent]);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento removido");
    },
  });

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <HudLabel>LIMITES</HudLabel>
          <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Orçamentos</h1>
          <p className="text-muted-foreground mt-2 text-sm">{monthLabel(month, year)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="border border-border p-2 hover:border-primary"><ChevronLeft className="size-4" /></button>
          <div className="border border-border px-4 py-2 text-sm uppercase font-mono">{monthLabel(month, year)}</div>
          <button onClick={() => shift(1)} className="border border-border p-2 hover:border-primary"><ChevronRight className="size-4" /></button>
          <button onClick={() => setOpen(true)} className="ml-2 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider font-medium">
            <Plus className="size-4" /> Novo
          </button>
        </div>
      </div>

      {budgets.length > 0 && (() => {
        const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0);
        const totalSpent = budgets.reduce((s, b) => s + (spentMap.get(b.category_id) ?? 0), 0);
        const remaining = totalBudget - totalSpent;
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiTile label="Total orçado" value={totalBudget} tone="info" />
            <KpiTile label="Total gasto" value={totalSpent} tone="flare" />
            <KpiTile label="Restante" value={remaining} tone={remaining >= 0 ? "lime" : "flare"} />
          </div>
        );
      })()}

      {budgets.length === 0 ? (
        <BrutalCard className="p-12 text-center">
          <div className="font-mono text-xs text-muted-foreground uppercase">[ NENHUM ORÇAMENTO PARA O MÊS ]</div>
          <button onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider">
            <Plus className="size-3.5" /> Definir primeiro limite
          </button>
        </BrutalCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...budgets]
            .sort((a, b) => {
              const pa = (spentMap.get(a.category_id) ?? 0) / Number(a.amount);
              const pb = (spentMap.get(b.category_id) ?? 0) / Number(b.amount);
              return pb - pa;
            })
            .map((b) => {
            const c = catMap.get(b.category_id);
            const used = spentMap.get(b.category_id) ?? 0;
            const pct = Math.min(100, (used / Number(b.amount)) * 100);
            const over = used > Number(b.amount);
            const barColor = pct > 90 ? "var(--flare)" : pct > 70 ? "var(--info)" : "var(--primary)";
            return (
              <BrutalCard key={b.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c?.emoji ?? "💸"}</span>
                    <span className="font-medium">{c?.name ?? "—"}</span>
                    {over && (
                      <span className="hud-label border border-[color:var(--flare)] text-[color:var(--flare)] px-1.5 py-0.5">
                        OVER
                      </span>
                    )}
                  </div>
                  <button onClick={() => confirm("Remover?") && del.mutate(b.id)} className="text-muted-foreground hover:text-[color:var(--flare)]">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex items-end justify-between mb-2 font-mono text-sm">
                  <span className={over ? "text-[color:var(--flare)]" : ""}>{brl(used)}</span>
                  <span className="text-muted-foreground">/ {brl(Number(b.amount))}</span>
                </div>
                <div className="relative h-2 border border-border bg-background overflow-hidden">
                  <div className="absolute inset-0 flex pointer-events-none">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex-1 border-r border-border last:border-0" />
                    ))}
                  </div>
                  <div className="h-full transition-all relative" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <div className="hud-label mt-2 text-right">{pct.toFixed(0)}% USADO</div>
              </BrutalCard>
            );
          })}
        </div>
      )}

      {open && user && (
        <BudgetModal
          userId={user.id}
          month={month}
          year={year}
          categories={cats}
          existing={budgets}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["budgets"] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function BudgetModal({
  userId, month, year, categories, existing, onClose, onSaved,
}: {
  userId: string; month: number; year: number; categories: Category[]; existing: Budget[]; onClose: () => void; onSaved: () => void;
}) {
  const usedIds = new Set(existing.map((b) => b.category_id));
  const available = categories.filter((c) => !usedIds.has(c.id));
  const [categoryId, setCategoryId] = useState(available[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("budgets").insert({
      user_id: userId,
      category_id: categoryId,
      month,
      year,
      amount: Number(amount),
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Orçamento criado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-md border border-border bg-[var(--surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Novo orçamento</h2>
          <button type="button" onClick={onClose}><X className="size-5" /></button>
        </div>
        <label className="block">
          <span className="hud-label block mb-1.5">Categoria</span>
          <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-[var(--surface)] border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            {available.length === 0 && <option value="">Todas as categorias já têm orçamento</option>}
            {available.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="hud-label block mb-1.5">Limite (R$)</span>
          <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border py-2.5 text-xs uppercase tracking-wider">Cancelar</button>
          <button disabled={saving || !categoryId} className="flex-1 bg-primary text-primary-foreground py-2.5 text-xs uppercase tracking-wider font-medium disabled:opacity-50">
            {saving ? "..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
