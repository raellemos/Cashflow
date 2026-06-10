import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listCategories, listTransactions } from "@/server/data.fn";
import { useAuth } from "@/lib/auth";
import { useMemo } from "react";
import { brl } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/app/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — CashFlow" }] }),
  component: ReportsPage,
});

type Tx = { date: string; amount_cents: number; type: string; category_id: string | null };
type Category = { id: string; name: string; color: string };

function ReportsPage() {
  const { user } = useAuth();

  const { data: txs = [] } = useQuery({
    queryKey: ["reports-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      const rows = await listTransactions({
        data: { from: since.toISOString().slice(0, 10), limit: 1000, offset: 0 },
      });
      return rows as Tx[];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => (await listCategories()) as Category[],
  });

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const monthly = useMemo(() => {
    const out: { label: string; income: number; expense: number; balance: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      d.setDate(1);
      out.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        income: 0,
        expense: 0,
        balance: 0,
      });
    }
    txs.forEach((t) => {
      const d = new Date(t.date + "T00:00:00");
      const idx =
        11 -
        ((new Date().getFullYear() - d.getFullYear()) * 12 +
          (new Date().getMonth() - d.getMonth()));
      if (idx < 0 || idx > 11) return;
      if (t.type === "income") out[idx].income += t.amount_cents;
      else out[idx].expense += t.amount_cents;
    });
    let acc = 0;
    out.forEach((o) => {
      acc += o.income - o.expense;
      o.balance = acc;
    });
    return out;
  }, [txs]);

  const byCategory = useMemo(() => {
    const m = new Map<string, { name: string; value: number; color: string }>();
    txs
      .filter((t) => t.type === "expense" && t.category_id)
      .forEach((t) => {
        const c = catMap.get(t.category_id!);
        if (!c) return;
        const cur = m.get(c.id) ?? { name: c.name, value: 0, color: c.color };
        cur.value += t.amount_cents;
        m.set(c.id, cur);
      });
    return Array.from(m.values()).sort((a, b) => b.value - a.value);
  }, [txs, catMap]);

  return (
    <div className="space-y-6">
      <div>
        <HudLabel>ANÁLISE</HudLabel>
        <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Relatórios</h1>
        <p className="text-muted-foreground text-sm mt-2">Últimos 12 meses</p>
      </div>

      <BrutalCard className="p-5">
        <HudLabel>SALDO ACUMULADO</HudLabel>
        <div className="h-72 mt-4">
          <ResponsiveContainer>
            <LineChart data={monthly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
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
                  fontSize: 12,
                }}
                formatter={(v: number) => brl(v)}
              />
              <Line
                type="stepAfter"
                dataKey="balance"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </BrutalCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BrutalCard className="p-5">
          <HudLabel>RECEITA × DESPESA · 12M</HudLabel>
          <div className="h-72 mt-4">
            <ResponsiveContainer>
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
          <HudLabel>DISTRIBUIÇÃO POR CATEGORIA</HudLabel>
          <div className="h-72 mt-4">
            {byCategory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-muted-foreground uppercase">
                [ SEM DADOS ]
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={95}
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
        </BrutalCard>
      </div>

      <BrutalCard className="p-5">
        <HudLabel>TOP 10 CATEGORIAS</HudLabel>
        <div className="mt-4 space-y-2">
          {byCategory.slice(0, 10).map((c) => {
            const max = byCategory[0]?.value ?? 1;
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span>{c.name}</span>
                  <span className="text-muted-foreground">{brl(c.value)}</span>
                </div>
                <div className="h-1.5 bg-background border border-border overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${(c.value / max) * 100}%`,
                      background: c.color || "var(--primary)",
                    }}
                  />
                </div>
              </div>
            );
          })}
          {byCategory.length === 0 && (
            <div className="font-mono text-xs text-muted-foreground uppercase text-center py-6">
              [ SEM DESPESAS ]
            </div>
          )}
        </div>
      </BrutalCard>
    </div>
  );
}
