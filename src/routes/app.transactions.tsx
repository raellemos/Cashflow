import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo, useState, useEffect } from "react";
import { brl, fmtDate } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { suggestCategory } from "@/lib/auto-categorization";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/transactions")({
  head: () => ({ meta: [{ title: "Transações — CashFlow" }] }),
  component: TransactionsPage,
});

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category_id: string | null;
  account_id: string | null;
  notes: string | null;
};

type Category = { id: string; name: string; emoji: string; color: string; kind: string };
type Account = { id: string; name: string; color: string };

function TransactionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [editing, setEditing] = useState<Tx | null>(null);
  const [open, setOpen] = useState(false);

  const txQuery = useQuery({
    queryKey: ["transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,date,description,amount,type,category_id,account_id,notes")
        .order("date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });

  const catQuery = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,emoji,color,kind");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const accQuery = useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id,name,color");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const txs = txQuery.data ?? [];
  const cats = catQuery.data ?? [];
  const accs = accQuery.data ?? [];
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  const accMap = useMemo(() => new Map(accs.map((a) => [a.id, a])), [accs]);

  const filtered = txs.filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
      toast.success("Transação removida");
    },
  });

  return (
    <div className="space-y-6">
      <div className="relative border border-border p-5 md:p-6 overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="absolute inset-0 scanline pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <HudLabel>OPERAÇÕES · LEDGER</HudLabel>
            <h1 className="font-display text-3xl md:text-5xl uppercase mt-1 tracking-tight">Transações</h1>
            <p className="text-muted-foreground mt-2 text-sm font-mono">
              [ {filtered.length.toString().padStart(4, "0")} REGISTROS ]
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-xs uppercase tracking-wider font-medium hover:opacity-90"
          >
            <Plus className="size-4" /> Nova transação
          </button>
        </div>
      </div>

      <BrutalCard className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição..."
              className="w-full bg-transparent border border-border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex border border-border">
            {(["all", "income", "expense"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilterType(k)}
                className={`px-4 py-2 text-xs uppercase tracking-wide font-mono ${
                  filterType === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {k === "all" ? "Todas" : k === "income" ? "Receitas" : "Despesas"}
              </button>
            ))}
          </div>
        </div>
      </BrutalCard>

      <BrutalCard className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center font-mono text-xs text-muted-foreground uppercase">
            [ NENHUMA TRANSAÇÃO ENCONTRADA ]
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="hud-label text-left px-4 py-2.5">Data</th>
                  <th className="hud-label text-left px-4 py-2.5">Descrição</th>
                  <th className="hud-label text-left px-4 py-2.5 hidden md:table-cell">Categoria</th>
                  <th className="hud-label text-left px-4 py-2.5 hidden lg:table-cell">Conta</th>
                  <th className="hud-label text-right px-4 py-2.5">Valor</th>
                  <th className="px-4 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const c = t.category_id ? catMap.get(t.category_id) : null;
                  const a = t.account_id ? accMap.get(t.account_id) : null;
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0 hover:bg-[var(--surface-elevated)]/40 transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(t.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`hud-label border px-1.5 py-0.5 ${
                              t.type === "income"
                                ? "border-primary text-primary"
                                : "border-[color:var(--flare)] text-[color:var(--flare)]"
                            }`}
                          >
                            {t.type === "income" ? "IN" : "OUT"}
                          </span>
                          <span className="text-base">{c?.emoji ?? "💸"}</span>
                          <span className="truncate">{t.description}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                        {c?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                        {a?.name ?? "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                          t.type === "income" ? "text-primary" : "text-[color:var(--flare)]"
                        }`}
                      >
                        {t.type === "income" ? "+" : "−"} {brl(Number(t.amount))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditing(t);
                              setOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Remover transação?")) del.mutate(t.id);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-[color:var(--flare)]"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </BrutalCard>

      {open && (
        <TxModal
          tx={editing}
          categories={cats}
          accounts={accs}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["transactions"] });
            qc.invalidateQueries({ queryKey: ["dashboard-tx"] });
            setOpen(false);
          }}
          userId={user!.id}
        />
      )}
    </div>
  );
}

function TxModal({
  tx,
  categories,
  accounts,
  userId,
  onClose,
  onSaved,
}: {
  tx: Tx | null;
  categories: Category[];
  accounts: Account[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(tx?.type ?? "expense");
  const [description, setDescription] = useState(tx?.description ?? "");
  const [amount, setAmount] = useState(tx ? String(tx.amount) : "");
  const [date, setDate] = useState(tx?.date ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>(tx?.category_id ?? "");
  const [accountId, setAccountId] = useState<string>(tx?.account_id ?? accounts[0]?.id ?? "");
  const [notes, setNotes] = useState(tx?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Auto-categorization suggestion
  useEffect(() => {
    if (tx) return;
    const suggested = suggestCategory(description);
    if (!suggested) return;
    const found = categories.find((c) => c.name.toLowerCase() === suggested.toLowerCase());
    if (found) setCategoryId(found.id);
  }, [description, categories, tx]);

  const filteredCats = categories.filter((c) => c.kind === type);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      user_id: userId,
      description,
      amount: Number(amount),
      type,
      date,
      category_id: categoryId || null,
      account_id: accountId || null,
      notes: notes || null,
    };
    const res = tx
      ? await supabase.from("transactions").update(payload).eq("id", tx.id)
      : await supabase.from("transactions").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(tx ? "Transação atualizada" : "Transação criada");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg border border-border bg-[var(--surface)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <HudLabel>{tx ? "EDITAR" : "NOVA"}</HudLabel>
            <h2 className="font-display text-2xl uppercase mt-1">Transação</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:text-[color:var(--flare)]">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="flex border border-border">
            {(["expense", "income"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`flex-1 py-2.5 text-xs uppercase font-mono tracking-wider ${
                  type === k
                    ? k === "income"
                      ? "bg-primary text-primary-foreground"
                      : "bg-[color:var(--flare)] text-white"
                    : "text-muted-foreground"
                }`}
              >
                {k === "expense" ? "Despesa" : "Receita"}
              </button>
            ))}
          </div>

          <Field label="Descrição">
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ex: Almoço iFood"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)">
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-[var(--surface)] border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Conta">
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-[var(--surface)] border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notas (opcional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground py-2.5 text-xs uppercase tracking-wider font-medium"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
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
