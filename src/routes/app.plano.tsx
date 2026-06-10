import { createFileRoute } from "@tanstack/react-router";
import { errMsg } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createActionPlan,
  createCreditScore,
  deleteActionPlan,
  listActionPlans,
  listCreditScores,
  updateActionPlan,
} from "@/server/data.fn";
import { useAuth } from "@/lib/auth";
import { useMemo, useState } from "react";
import { brl, fmtDateLong } from "@/lib/format";
import { parseBRLToCents } from "@/lib/money";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { Plus, Trash2, X, CheckCircle2, Circle, Activity } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/app/plano")({
  head: () => ({ meta: [{ title: "Plano de ação — CashFlow" }] }),
  component: PlanPage,
});

type Plan = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "done";
  amount_cents: number | null;
  creditor: string | null;
};
type Score = { id: string; score: number; recorded_at: string };

function PlanPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openPlan, setOpenPlan] = useState(false);
  const [openScore, setOpenScore] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["plans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = (await listActionPlans()) as Plan[];
      return rows.sort(
        (a, b) =>
          a.status.localeCompare(b.status) ||
          (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
      );
    },
  });

  const { data: scores = [] } = useQuery({
    queryKey: ["scores", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const rows = (await listCreditScores()) as Score[];
      return rows.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    },
  });

  const latest = scores.at(-1);
  const previous = scores.at(-2);
  const delta = latest && previous ? latest.score - previous.score : 0;

  const totalDebt = useMemo(
    () =>
      plans
        .filter((p) => p.status === "pending" && p.amount_cents)
        .reduce((s, p) => s + (p.amount_cents ?? 0), 0),
    [plans],
  );
  const done = plans.filter((p) => p.status === "done").length;
  const total = plans.length;

  const toggleStatus = useMutation({
    mutationFn: async (p: Plan) => {
      await updateActionPlan({
        data: {
          id: p.id,
          data: {
            title: p.title,
            description: p.description,
            dueDate: p.due_date,
            status: p.status === "done" ? "pending" : "done",
            amountCents: p.amount_cents,
            creditor: p.creditor,
          },
        },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteActionPlan({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["plans"] });
      toast.success("Removido");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <HudLabel>RECUPERAÇÃO</HudLabel>
        <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Plano de ação</h1>
      </div>

      {/* Score */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BrutalCard className="p-6 lg:col-span-1">
          <div className="flex items-center justify-between">
            <HudLabel>SCORE ATUAL</HudLabel>
            <button onClick={() => setOpenScore(true)} className="hud-label hover:text-primary">
              + NOVO
            </button>
          </div>
          <div className="mt-3 font-display text-6xl text-primary tabular-nums">
            {latest?.score ?? "—"}
          </div>
          {latest && (
            <div className="mt-2 text-xs font-mono">
              <span
                className={
                  delta > 0
                    ? "text-primary"
                    : delta < 0
                      ? "text-[color:var(--flare)]"
                      : "text-muted-foreground"
                }
              >
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {Math.abs(delta)} pts
              </span>
              <span className="text-muted-foreground"> · {fmtDateLong(latest.recorded_at)}</span>
            </div>
          )}
          <div className="mt-4 h-2 border border-border bg-background overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(100, ((latest?.score ?? 0) / 1000) * 100)}%` }}
            />
          </div>
          <div className="hud-label mt-2 text-right">META · 1000</div>
        </BrutalCard>

        <BrutalCard className="p-5 lg:col-span-2">
          <HudLabel>HISTÓRICO DE SCORE</HudLabel>
          <div className="h-40 mt-3">
            {scores.length < 2 ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-muted-foreground uppercase">
                [ REGISTRE PELO MENOS 2 PONTOS ]
              </div>
            ) : (
              <ResponsiveContainer>
                <LineChart data={scores} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <XAxis
                    dataKey="recorded_at"
                    stroke="var(--fg-meta)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("pt-BR", { month: "short" })
                    }
                  />
                  <YAxis
                    stroke="var(--fg-meta)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 1000]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 0,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: "var(--primary)", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </BrutalCard>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <BrutalCard className="p-5">
          <HudLabel>DÍVIDA TOTAL</HudLabel>
          <div className="font-display text-3xl text-[color:var(--flare)] mt-2 tabular-nums">
            {brl(totalDebt)}
          </div>
        </BrutalCard>
        <BrutalCard className="p-5">
          <HudLabel>AÇÕES</HudLabel>
          <div className="font-display text-3xl mt-2 tabular-nums">
            {done}/{total}
          </div>
        </BrutalCard>
        <BrutalCard className="p-5 col-span-2 lg:col-span-1">
          <HudLabel>PROGRESSO</HudLabel>
          <div className="font-display text-3xl text-primary mt-2 tabular-nums">
            {total === 0 ? "0" : Math.round((done / total) * 100)}
            <span className="text-xl">%</span>
          </div>
        </BrutalCard>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <HudLabel>AÇÕES</HudLabel>
        <button
          onClick={() => setOpenPlan(true)}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-xs uppercase tracking-wider font-medium"
        >
          <Plus className="size-4" /> Nova ação
        </button>
      </div>

      {plans.length === 0 ? (
        <BrutalCard className="p-12 text-center">
          <Activity className="size-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-mono text-xs text-muted-foreground uppercase">
            [ SEM AÇÕES PROGRAMADAS ]
          </div>
        </BrutalCard>
      ) : (
        <div className="space-y-2">
          {plans.map((p) => (
            <BrutalCard
              key={p.id}
              className={`p-4 flex items-center gap-4 ${p.status === "done" ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => toggleStatus.mutate(p)}
                className={
                  p.status === "done" ? "text-primary" : "text-muted-foreground hover:text-primary"
                }
              >
                {p.status === "done" ? (
                  <CheckCircle2 className="size-5" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`font-medium ${p.status === "done" ? "line-through" : ""}`}>
                  {p.title}
                </div>
                <div className="hud-label mt-0.5 truncate">
                  {p.creditor && `${p.creditor.toUpperCase()} · `}
                  {p.due_date && `VENCE ${fmtDateLong(p.due_date).toUpperCase()}`}
                  {p.description && ` · ${p.description}`}
                </div>
              </div>
              {p.amount_cents && (
                <div className="font-mono tabular-nums text-[color:var(--flare)] text-sm">
                  {brl(p.amount_cents)}
                </div>
              )}
              <button
                onClick={() => confirm("Remover?") && del.mutate(p.id)}
                className="text-muted-foreground hover:text-[color:var(--flare)] p-1"
              >
                <Trash2 className="size-3.5" />
              </button>
            </BrutalCard>
          ))}
        </div>
      )}

      {openPlan && user && (
        <PlanModal
          onClose={() => setOpenPlan(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["plans"] });
            setOpenPlan(false);
          }}
        />
      )}
      {openScore && user && (
        <ScoreModal
          onClose={() => setOpenScore(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["scores"] });
            setOpenScore(false);
          }}
        />
      )}
    </div>
  );
}

function PlanModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creditor, setCreditor] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    let amountCents: number | null = null;
    try {
      if (amount.trim()) amountCents = parseBRLToCents(amount);
    } catch (err) {
      toast.error(errMsg(err, "Valor inválido"));
      return;
    }
    setSaving(true);
    try {
      await createActionPlan({
        data: {
          title,
          description: description || null,
          creditor: creditor || null,
          amountCents,
          dueDate: dueDate || null,
          status: "pending",
        },
      });
      toast.success("Ação criada");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form
        onSubmit={save}
        className="relative w-full max-w-md border border-border bg-[var(--surface)] p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">Nova ação</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <Field label="Título">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Credor">
            <input
              value={creditor}
              onChange={(e) => setCreditor(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
          <Field label="Valor (R$)">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </Field>
        </div>
        <Field label="Vencimento">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-border py-2.5 text-xs uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground py-2.5 text-xs uppercase tracking-wider font-medium"
          >
            {saving ? "..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ScoreModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [score, setScore] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createCreditScore({
        data: { score: Number(score), recordedAt: date, notes: null },
      });
      toast.success("Score registrado");
      onSaved();
    } catch (err) {
      toast.error(errMsg(err, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form
        onSubmit={save}
        className="relative w-full max-w-sm border border-border bg-[var(--surface)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Novo score</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <Field label="Score (0-1000)">
          <input
            required
            type="number"
            min="0"
            max="1000"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <Field label="Data">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-border py-2.5 text-xs uppercase tracking-wider"
          >
            Cancelar
          </button>
          <button
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground py-2.5 text-xs uppercase tracking-wider font-medium"
          >
            {saving ? "..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="hud-label block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
