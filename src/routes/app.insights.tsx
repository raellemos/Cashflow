import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { brl } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { KpiTile } from "@/components/kpi-tile";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";


export const Route = createFileRoute("/app/insights")({
  head: () => ({
    meta: [
      { title: "Insights — CashFlow" },
      {
        name: "description",
        content: "Tendências de receitas e despesas por categoria e conta nos últimos meses.",
      },
    ],
  }),
  component: InsightsPage,
});

type Tx = {
  date: string;
  amount: number;
  type: string;
  category_id: string | null;
  account_id: string | null;
};
type Category = { id: string; name: string; color: string; emoji: string; kind: string };
type Account = { id: string; name: string; color: string; type: string };

const MONTHS_WINDOW = 6;

function InsightsPage() {
  const { user } = useAuth();

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ["insights-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - (MONTHS_WINDOW - 1));
      since.setDate(1);
      const { data, error } = await supabase
        .from("transactions")
        .select("date,amount,type,category_id,account_id")
        .gte("date", since.toISOString().slice(0, 10))
        .order("date");
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name,color,emoji,kind");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name,color,type");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const accMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Últimos N meses timeline
  const months = useMemo(() => {
    const out: { key: string; label: string; year: number; month: number }[] = [];
    for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      out.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
    return out;
  }, []);

  const timeline = useMemo(() => {
    const map = new Map(months.map((m) => [m.key, { ...m, income: 0, expense: 0, net: 0 }]));
    txs.forEach((t) => {
      const d = new Date(t.date + "T00:00:00");
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const row = map.get(k);
      if (!row) return;
      if (t.type === "income") row.income += Number(t.amount);
      else row.expense += Number(t.amount);
      row.net = row.income - row.expense;
    });
    return Array.from(map.values());
  }, [txs, months]);

  // Totais dos últimos 2 meses fechados para variação
  const trend = useMemo(() => {
    const last = timeline[timeline.length - 1];
    const prev = timeline[timeline.length - 2];
    const pct = (a: number, b: number) => (b === 0 ? 0 : ((a - b) / b) * 100);
    return {
      income: { curr: last?.income ?? 0, prev: prev?.income ?? 0, pct: pct(last?.income ?? 0, prev?.income ?? 0) },
      expense: { curr: last?.expense ?? 0, prev: prev?.expense ?? 0, pct: pct(last?.expense ?? 0, prev?.expense ?? 0) },
      net: { curr: last?.net ?? 0, prev: prev?.net ?? 0, pct: pct(last?.net ?? 0, prev?.net ?? 0) },
    };
  }, [timeline]);

  // Despesas por categoria (agregado)
  const expenseByCategory = useMemo(() => {
    const m = new Map<string, { name: string; value: number; color: string }>();
    txs
      .filter((t) => t.type === "expense" && t.category_id)
      .forEach((t) => {
        const c = catMap.get(t.category_id!);
        if (!c) return;
        const cur = m.get(c.id) ?? { name: c.name, value: 0, color: c.color };
        cur.value += Number(t.amount);
        m.set(c.id, cur);
      });
    return Array.from(m.values()).sort((a, b) => b.value - a.value);
  }, [txs, catMap]);

  // Receitas por categoria
  const incomeByCategory = useMemo(() => {
    const m = new Map<string, { name: string; value: number; color: string }>();
    txs
      .filter((t) => t.type === "income" && t.category_id)
      .forEach((t) => {
        const c = catMap.get(t.category_id!);
        if (!c) return;
        const cur = m.get(c.id) ?? { name: c.name, value: 0, color: c.color };
        cur.value += Number(t.amount);
        m.set(c.id, cur);
      });
    return Array.from(m.values()).sort((a, b) => b.value - a.value);
  }, [txs, catMap]);

  // Movimentação por conta
  const byAccount = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string; income: number; expense: number; net: number }>();
    txs.forEach((t) => {
      if (!t.account_id) return;
      const a = accMap.get(t.account_id);
      if (!a) return;
      const cur = m.get(a.id) ?? { id: a.id, name: a.name, color: a.color, income: 0, expense: 0, net: 0 };
      if (t.type === "income") cur.income += Number(t.amount);
      else cur.expense += Number(t.amount);
      cur.net = cur.income - cur.expense;
      m.set(a.id, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.income + b.expense - (a.income + a.expense));
  }, [txs, accMap]);

  // Tendência top 5 categorias (despesa) ao longo do tempo
  const topExpenseCategories = expenseByCategory.slice(0, 5);
  const categoryTrend = useMemo(() => {
    const rows = months.map((m) => {
      const row: Record<string, string | number> = { label: m.label };
      topExpenseCategories.forEach((c) => (row[c.name] = 0));
      return row;
    });
    txs
      .filter((t) => t.type === "expense" && t.category_id)
      .forEach((t) => {
        const cat = catMap.get(t.category_id!);
        if (!cat) return;
        if (!topExpenseCategories.find((c) => c.name === cat.name)) return;
        const d = new Date(t.date + "T00:00:00");
        const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
        if (idx < 0) return;
        rows[idx][cat.name] = (rows[idx][cat.name] as number) + Number(t.amount);
      });
    return rows;
  }, [txs, catMap, months, topExpenseCategories]);

  const chartTip = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 0,
    fontSize: 12,
  } as const;

  const trendIcon = (pct: number, invert = false) => {
    const good = invert ? pct < 0 : pct > 0;
    const flat = Math.abs(pct) < 0.5;
    if (flat) return <Minus className="size-3" />;
    return good ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />;
  };

  const totalExpense = expenseByCategory.reduce((s, c) => s + c.value, 0);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none" />
        <div className="relative">
          <HudLabel>INTELIGÊNCIA · {MONTHS_WINDOW}M</HudLabel>
          <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Insights</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Tendências de receitas, despesas e movimentação por categoria e conta.
          </p>
        </div>
      </div>

      {/* KPIs de tendência mês vs mês anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiTile
          label="Receitas · MoM"
          value={trend.income.curr}
          delta={`${trend.income.pct >= 0 ? "+" : ""}${trend.income.pct.toFixed(1)}%`}
          tone={trend.income.pct >= 0 ? "lime" : "flare"}
        />
        <KpiTile
          label="Despesas · MoM"
          value={trend.expense.curr}
          delta={`${trend.expense.pct >= 0 ? "+" : ""}${trend.expense.pct.toFixed(1)}%`}
          tone={trend.expense.pct <= 0 ? "lime" : "flare"}
        />
        <KpiTile
          label="Saldo líquido · MoM"
          value={trend.net.curr}
          delta={`${trend.net.pct >= 0 ? "+" : ""}${trend.net.pct.toFixed(1)}%`}
          tone={trend.net.curr >= 0 ? "lime" : "flare"}
        />
      </div>

      {/* Fluxo mensal */}
      <BrutalCard className="p-5">
        <div className="flex items-center justify-between">
          <HudLabel>FLUXO MENSAL · {MONTHS_WINDOW}M</HudLabel>
          <span className="hud-label">RECEITA vs DESPESA</span>
        </div>
        <div className="h-72 mt-4">
          <ResponsiveContainer>
            <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--flare)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--flare)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--fg-meta)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                stroke="var(--fg-meta)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip contentStyle={chartTip} formatter={(v: number) => brl(v)} />
              <Area type="monotone" dataKey="income" stroke="var(--primary)" strokeWidth={2} fill="url(#inc)" name="Receita" />
              <Area type="monotone" dataKey="expense" stroke="var(--flare)" strokeWidth={2} fill="url(#exp)" name="Despesa" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BrutalCard>

      {/* Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BrutalCard className="p-5">
          <HudLabel>DESPESAS POR CATEGORIA</HudLabel>
          <div className="h-72 mt-4">
            {expenseByCategory.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={100}
                    stroke="var(--background)"
                  >
                    {expenseByCategory.map((d, i) => (
                      <Cell key={i} fill={d.color || "var(--flare)"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTip} formatter={(v: number) => brl(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
            {expenseByCategory.slice(0, 8).map((c) => {
              const pct = totalExpense ? (c.value / totalExpense) * 100 : 0;
              return (
                <div key={c.name} className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 shrink-0" style={{ background: c.color || "var(--flare)" }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                    <span>{brl(c.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </BrutalCard>

        <BrutalCard className="p-5">
          <HudLabel>RECEITAS POR CATEGORIA</HudLabel>
          <div className="h-72 mt-4">
            {incomeByCategory.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <BarChart data={incomeByCategory} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="var(--fg-meta)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--fg-meta)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip contentStyle={chartTip} formatter={(v: number) => brl(v)} />
                  <Bar dataKey="value" name="Receita">
                    {incomeByCategory.map((d, i) => (
                      <Cell key={i} fill={d.color || "var(--primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </BrutalCard>
      </div>

      {/* Tendência top categorias */}
      <BrutalCard className="p-5">
        <div className="flex items-center justify-between">
          <HudLabel>TENDÊNCIA · TOP 5 DESPESAS</HudLabel>
          <span className="hud-label">EVOLUÇÃO MENSAL</span>
        </div>
        <div className="h-80 mt-4">
          {topExpenseCategories.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <LineChart data={categoryTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--fg-meta)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--fg-meta)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip contentStyle={chartTip} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11, textTransform: "uppercase" }} />
                {topExpenseCategories.map((c) => (
                  <Line
                    key={c.name}
                    type="monotone"
                    dataKey={c.name}
                    stroke={c.color || "var(--flare)"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </BrutalCard>

      {/* Por conta */}
      <BrutalCard className="p-5">
        <div className="flex items-center justify-between">
          <HudLabel>MOVIMENTAÇÃO POR CONTA</HudLabel>
          <span className="hud-label">ENTRADAS × SAÍDAS</span>
        </div>
        <div className="h-72 mt-4">
          {byAccount.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer>
              <BarChart data={byAccount} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--fg-meta)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--fg-meta)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip contentStyle={chartTip} formatter={(v: number) => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 11, textTransform: "uppercase" }} />
                <Bar dataKey="income" name="Receita" fill="var(--primary)" />
                <Bar dataKey="expense" name="Despesa" fill="var(--flare)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {byAccount.map((a) => (
            <div key={a.id} className="border border-border p-3 bg-[var(--surface-elevated)]/40">
              <div className="flex items-center gap-2">
                <span className="size-2.5" style={{ background: a.color || "var(--primary)" }} />
                <span className="text-sm font-medium uppercase tracking-wide truncate">{a.name}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
                <div>
                  <div className="hud-label" style={{ fontSize: 9 }}>IN</div>
                  <div className="text-[color:var(--primary)]">{brl(a.income)}</div>
                </div>
                <div>
                  <div className="hud-label" style={{ fontSize: 9 }}>OUT</div>
                  <div className="text-[color:var(--flare)]">{brl(a.expense)}</div>
                </div>
                <div>
                  <div className="hud-label" style={{ fontSize: 9 }}>NET</div>
                  <div className={a.net >= 0 ? "" : "text-[color:var(--flare)]"}>{brl(a.net)}</div>
                </div>
              </div>
            </div>
          ))}
          {byAccount.length === 0 && (
            <div className="font-mono text-xs text-muted-foreground uppercase text-center py-6 col-span-full">
              [ SEM MOVIMENTAÇÃO ]
            </div>
          )}
        </div>
      </BrutalCard>

      {isLoading && (
        <div className="text-center font-mono text-xs text-muted-foreground uppercase">
          [ CARREGANDO SINAL... ]
        </div>
      )}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground uppercase">
      [ SEM DADOS NO PERÍODO ]
    </div>
  );
}
