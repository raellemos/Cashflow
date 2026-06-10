import { createFileRoute } from "@tanstack/react-router";
import { errMsg } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/server/data.fn";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { brl, fmtDateLong } from "@/lib/format";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { Plus, Trash2, X, Pencil, Target } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/metas")({
  head: () => ({ meta: [{ title: "Metas — CashFlow" }] }),
  component: GoalsPage,
});

type Goal = {
  id: string;
  title: string;
  target_amount_cents: number;
  current_amount_cents: number;
  deadline: string | null;
  notes: string | null;
};

function GoalsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [open, setOpen] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", user?.id],
    enabled: !!user,
    queryFn: async () => (await listGoals()) as Goal[],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteGoal({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Meta removida");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <HudLabel>OBJETIVOS</HudLabel>
          <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Metas</h1>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-xs uppercase tracking-wider font-medium"
        >
          <Plus className="size-4" /> Nova meta
        </button>
      </div>

      {goals.length === 0 ? (
        <BrutalCard className="p-12 text-center">
          <Target className="size-10 mx-auto text-muted-foreground mb-3" />
          <div className="font-mono text-xs text-muted-foreground uppercase">
            [ DEFINA SEU PRIMEIRO OBJETIVO ]
          </div>
        </BrutalCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const pct = Math.min(
              100,
              g.target_amount_cents > 0
                ? (g.current_amount_cents / g.target_amount_cents) * 100
                : 0,
            );
            return (
              <BrutalCard key={g.id} className="p-5 group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-xl uppercase">{g.title}</h3>
                    {g.deadline && (
                      <div className="hud-label mt-1">
                        PRAZO · {fmtDateLong(g.deadline).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(g);
                        setOpen(true);
                      }}
                      className="p-1"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => confirm("Remover meta?") && del.mutate(g.id)}
                      className="p-1 hover:text-[color:var(--flare)]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end justify-between font-mono text-sm mb-2">
                  <span className="text-primary">{brl(g.current_amount_cents)}</span>
                  <span className="text-muted-foreground">/ {brl(g.target_amount_cents)}</span>
                </div>
                <div className="h-2 border border-border bg-background overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="hud-label">{pct.toFixed(0)}% CONCLUÍDO</span>
                  {g.notes && (
                    <span className="text-xs text-muted-foreground truncate max-w-[60%]">
                      {g.notes}
                    </span>
                  )}
                </div>
              </BrutalCard>
            );
          })}
        </div>
      )}

      {open && user && (
        <GoalModal
          goal={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["goals"] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function GoalModal({
  goal,
  onClose,
  onSaved,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [target, setTarget] = useState(goal ? centsToInput(goal.target_amount_cents) : "");
  const [current, setCurrent] = useState(goal ? centsToInput(goal.current_amount_cents) : "0");
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    let targetAmountCents: number;
    let currentAmountCents: number;
    try {
      targetAmountCents = parseBRLToCents(target);
      currentAmountCents = parseBRLToCents(current || "0");
    } catch (err) {
      toast.error(errMsg(err, "Valor inválido"));
      return;
    }
    setSaving(true);
    const data = {
      title,
      targetAmountCents,
      currentAmountCents,
      deadline: deadline || null,
      notes: notes || null,
    };
    try {
      if (goal) await updateGoal({ data: { id: goal.id, data } });
      else await createGoal({ data });
      toast.success("Meta salva");
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
          <h2 className="font-display text-2xl uppercase">{goal ? "Editar" : "Nova"} meta</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <label className="block">
          <span className="hud-label block mb-1.5">Título</span>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ex: Reserva de emergência"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="hud-label block mb-1.5">Alvo (R$)</span>
            <input
              required
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="hud-label block mb-1.5">Atual (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>
        <label className="block">
          <span className="hud-label block mb-1.5">Prazo</span>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="hud-label block mb-1.5">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
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
