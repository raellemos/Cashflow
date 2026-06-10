import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCategories, listTransactions } from "@/server/data.fn";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { brl, fmtDate, monthLabel } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { KpiTile } from "@/components/kpi-tile";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Plus, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CashFlow" }] }),
  component: DashboardPage,
});

type Tx = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string | null;
};

type Category = { id: string; name: string; emoji: string; color: string; kind: string };

function DashboardPage() {
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const txQuery = useQuery({
    queryKey: ["dashboard-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      const rows = await listTransactions({
        data: { from: since.toISOString().slice(0, 10), limit: 1000, offset: 0 },
      });
      return rows as Tx[];
    },
  });

  const catQuery = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => (await listCategories()) as Category[],
  });

  const txs = txQuery.data ?? [];
  const cats = catQuery.data ?? [];
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const monthly = useMemo(() => {
    const out: { key: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1, 1);
      d.setMonth(d.getMonth() - i);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      out.push({
        key: `${y}-${m}`,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        income: 0,
        expense: 0,
      });
    }
    txs.forEach((t) => {
      const d = new Date(t.date + "T00:00:00");
      const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const slot = out.find((o) => o.key === k);
      if (!slot) return;
      if (t.type === "income") slot.income += t.amount_cents;
      else slot.expense += t.amount_cents;
    });
    return out;
  }, [txs, month, year]);

  const monthTxs = useMemo(
    () =>
      txs.filter((t) => {
        const d = new Date(t.date + "T00:00:00");
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }),
    [txs, month, year],
  );

  const income = monthTxs
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount_cents, 0);
  const expense = monthTxs
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount_cents, 0);
  const balance = income - expense;

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string }>();
    monthTxs
      .filter((t) => t.type === "expense" && t.category_id)
      .forEach((t) => {
        const c = catMap.get(t.category_id!);
        if (!c) return;
        const cur = map.get(c.id) ?? { name: c.name, value: 0, color: c.color };
        cur.value += t.amount_cents;
        map.set(c.id, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [monthTxs, catMap]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="relative border border-border p-5 md:p-6 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <HudLabel>COCKPIT · VISÃO GERAL</HudLabel>
            <h1 className="font-display text-3xl md:text-5xl uppercase mt-1 tracking-tight">
              Dashboard
            </h1>
            <p className="text-muted-foreground mt-2 text-sm font-mono">
              [ {monthLabel(month, year).toUpperCase()} ]
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftMonth(-1)}
              className="border border-border p-2 hover:border-primary transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="border border-border px-4 py-2 text-sm uppercase font-mono bg-background">
              {monthLabel(month, year)}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              className="border border-border p-2 hover:border-primary transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
            <Link
              to="/app/transactions"
              className="hidden md:inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider font-medium ml-2 hover:opacity-90"
            >
              <Plus className="size-4" /> Nova transação
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Saldo do mês" value={balance} tone={balance >= 0 ? "lime" : "flare"} />
        <KpiTile label="Receitas" value={income} tone="lime" />
        <KpiTile label="Despesas" value={expense} tone="flare" />
        <KpiTile
          label="Taxa de poupança"
          value={savingsRate}
          tone={savingsRate >= 0 ? "info" : "flare"}
          format="number"
          delta="%"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BrutalCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <HudLabel>FLUXO · 6 MESES</HudLabel>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2 bg-primary" /> Receita
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 bg-[color:var(--flare)]" /> Despesa
              </span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--fg-meta)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--fg-meta)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 100000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => brl(v)}
                />
                <Bar dataKey="income" fill="var(--primary)" />
                <Bar dataKey="expense" fill="var(--flare)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </BrutalCard>

        <BrutalCard className="p-5">
          <HudLabel>POR CATEGORIA</HudLabel>
          <div className="h-64 mt-4">
            {byCategory.length === 0 ? (
              <EmptyMini text="Sem despesas no mês" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={85}
                    stroke="var(--background)"
                  >
                    {byCategory.map((d, i) => (
                      <Cell key={i} fill={d.color || "var(--primary)"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => brl(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
            {byCategory.slice(0, 5).map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2">
                  <span className="size-2" style={{ background: c.color }} />
                  {c.name}
                </span>
                <span className="text-muted-foreground">{brl(c.value)}</span>
              </div>
            ))}
          </div>
        </BrutalCard>
      </div>

      {/* Recent transactions */}
      <BrutalCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <HudLabel>ÚLTIMAS TRANSAÇÕES</HudLabel>
          <Link
            to="/app/transactions"
            className="text-xs uppercase font-mono text-primary hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        {monthTxs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-border">
            {monthTxs.slice(0, 8).map((t) => {
              const c = t.category_id ? catMap.get(t.category_id) : null;
              return (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <div
                    className="size-9 flex items-center justify-center text-base border border-border"
                    style={{ background: c?.color ? `${c.color}20` : "transparent" }}
                  >
                    {c?.emoji ?? (t.type === "income" ? "💰" : "💸")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.description}</div>
                    <div className="hud-label" style={{ fontSize: 10 }}>
                      {fmtDate(t.date)} · {c?.name ?? "Sem categoria"}
                    </div>
                  </div>
                  <div
                    className={`font-mono tabular-nums text-sm flex items-center gap-1 ${
                      t.type === "income" ? "text-primary" : "text-[color:var(--flare)]"
                    }`}
                  >
                    {t.type === "income" ? (
                      <ArrowUpRight className="size-3.5" />
                    ) : (
                      <ArrowDownRight className="size-3.5" />
                    )}
                    {brl(t.amount_cents)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BrutalCard>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono uppercase">
      [ {text} ]
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-10">
      <div className="font-mono text-muted-foreground text-xs uppercase">
        [ NENHUMA TRANSAÇÃO NO MÊS ]
      </div>
      <Link
        to="/app/transactions"
        className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider"
      >
        <Plus className="size-3.5" /> Lançar primeira transação
      </Link>
    </div>
  );
}
