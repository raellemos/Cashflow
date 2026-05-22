import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMemo, useState, useEffect } from "react";
import { brl, fmtDate } from "@/lib/format";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { ExportMenu } from "@/components/export-menu";
import { exportCSV, exportPDF } from "@/lib/export";
import { suggestCategory } from "@/lib/auto-categorization";
import { Plus, Pencil, Trash2, X, Search, Share2, FilterX } from "lucide-react";
import { toast } from "sonner";

const transactionsSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  type: fallback(z.enum(["all", "income", "expense"]), "all").default("all"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  accountId: fallback(z.string(), "").default(""),
  categoryId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/app/transactions")({
  head: () => ({ meta: [{ title: "Transações — CashFlow" }] }),
  validateSearch: zodValidator(transactionsSearchSchema),
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
  const navigate = useNavigate({ from: "/app/transactions" });
  const search = Route.useSearch();
  const { q, type, from, to, accountId, categoryId } = search;

  const [editing, setEditing] = useState<Tx | null>(null);
  const [open, setOpen] = useState(false);
  const [qLocal, setQLocal] = useState(q);

  // Debounce text search → URL
  useEffect(() => {
    setQLocal(q);
  }, [q]);
  useEffect(() => {
    const id = setTimeout(() => {
      if (qLocal !== q) {
        navigate({ search: (prev) => ({ ...prev, q: qLocal }), replace: true });
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  const setParam = <K extends keyof typeof search>(key: K, value: (typeof search)[K]) => {
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: true });
  };

  const clearFilters = () => {
    navigate({
      search: { q: "", type: "all", from: "", to: "", accountId: "", categoryId: "" },
      replace: true,
    });
  };

  const activeFiltersCount =
    (q ? 1 : 0) +
    (type !== "all" ? 1 : 0) +
    (from ? 1 : 0) +
    (to ? 1 : 0) +
    (accountId ? 1 : 0) +
    (categoryId ? 1 : 0);

  const txQuery = useQuery({
    queryKey: ["transactions", user?.id, from, to],
    enabled: !!user,
    queryFn: async () => {
      let qb = supabase
        .from("transactions")
        .select("id,date,description,amount,type,category_id,account_id,notes")
        .order("date", { ascending: false })
        .limit(1000);
      if (from) qb = qb.gte("date", from);
      if (to) qb = qb.lte("date", to);
      const { data, error } = await qb;
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
    if (type !== "all" && t.type !== type) return false;
    if (accountId && t.account_id !== accountId) return false;
    if (categoryId && t.category_id !== categoryId) return false;
    if (q && !t.description.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filtered.forEach((t) => {
      if (t.type === "income") income += Number(t.amount);
      else expense += Number(t.amount);
    });
    return { income, expense, net: income - expense };
  }, [filtered]);

  const setPeriodPreset = (preset: "month" | "30d" | "90d" | "year") => {
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    let start = new Date(today);
    if (preset === "month") start = new Date(today.getFullYear(), today.getMonth(), 1);
    else if (preset === "30d") start.setDate(start.getDate() - 30);
    else if (preset === "90d") start.setDate(start.getDate() - 90);
    else if (preset === "year") start = new Date(today.getFullYear(), 0, 1);
    navigate({
      search: (prev) => ({ ...prev, from: start.toISOString().slice(0, 10), to: end }),
      replace: true,
    });
  };

  const shareUrl = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar — copie manualmente da barra de endereço");
    }
  };
  const buildExportRows = () =>
    filtered.map((t) => {
      const c = t.category_id ? catMap.get(t.category_id) : null;
      const a = t.account_id ? accMap.get(t.account_id) : null;
      return [
        t.date,
        t.description,
        t.type === "income" ? "Receita" : "Despesa",
        c?.name ?? "",
        a?.name ?? "",
        Number(t.amount).toFixed(2).replace(".", ","),
      ];
    });

  const periodLabel = () => {
    if (from && to) return `${fmtDate(from)} a ${fmtDate(to)}`;
    if (from) return `desde ${fmtDate(from)}`;
    if (to) return `até ${fmtDate(to)}`;
    return "Todo o período";
  };

  const fileSlug = () => {
    const a = from || "inicio";
    const b = to || new Date().toISOString().slice(0, 10);
    return `${a}_${b}`;
  };

  const handleExportCSV = () => {
    if (!filtered.length) return toast.error("Nenhuma transação no recorte atual");
    exportCSV(
      `transacoes_${fileSlug()}.csv`,
      ["Data", "Descrição", "Tipo", "Categoria", "Conta", "Valor (R$)"],
      buildExportRows(),
    );
    toast.success(`${filtered.length} transações exportadas`);
  };

  const handleExportPDF = () => {
    if (!filtered.length) return toast.error("Nenhuma transação no recorte atual");
    const rows = filtered.map((t) => {
      const c = t.category_id ? catMap.get(t.category_id) : null;
      const a = t.account_id ? accMap.get(t.account_id) : null;
      const sign = t.type === "income" ? "+" : "−";
      return [
        fmtDate(t.date),
        t.description,
        c?.name ?? "—",
        a?.name ?? "—",
        `${sign} ${brl(Number(t.amount))}`,
      ];
    });
    exportPDF({
      title: "Relatório de transações",
      subtitle: periodLabel(),
      meta: {
        Registros: String(filtered.length),
        Tipo: type === "all" ? "Todos" : type === "income" ? "Receitas" : "Despesas",
        Categoria: categoryId ? cats.find((c) => c.id === categoryId)?.name ?? "—" : "Todas",
        Conta: accountId ? accs.find((a) => a.id === accountId)?.name ?? "—" : "Todas",
        ...(q ? { Busca: q } : {}),
      },
      summary: [
        { label: "Receitas", value: brl(totals.income) },
        { label: "Despesas", value: brl(totals.expense) },
        { label: "Saldo", value: brl(totals.net) },
      ],
      headers: ["Data", "Descrição", "Categoria", "Conta", "Valor"],
      rows,
      align: ["left", "left", "left", "left", "right"],
      filename: `transacoes_${fileSlug()}.pdf`,
    });
    toast.success("PDF gerado");
  };


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
              [ {filtered.length.toString().padStart(4, "0")} REGISTROS · NET {brl(totals.net)} ]
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu onCSV={handleExportCSV} onPDF={handleExportPDF} disabled={!filtered.length} />
            <button
              onClick={shareUrl}
              className="inline-flex items-center gap-2 border border-border text-foreground px-3 py-2.5 text-xs uppercase tracking-wider font-medium hover:border-primary hover:text-primary transition-colors"
              title="Copiar link com filtros aplicados"
            >
              <Share2 className="size-4" /> <span className="hidden sm:inline">Compartilhar</span>
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-xs uppercase tracking-wider font-medium hover:opacity-90"
            >
              <Plus className="size-4" /> Nova
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <BrutalCard className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <HudLabel>FILTROS{activeFiltersCount > 0 ? ` · ${activeFiltersCount} ATIVOS` : ""}</HudLabel>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 text-xs uppercase font-mono text-muted-foreground hover:text-[color:var(--flare)] transition-colors"
            >
              <FilterX className="size-3.5" /> Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2 lg:col-span-2">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={qLocal}
              onChange={(e) => setQLocal(e.target.value)}
              placeholder="Buscar descrição..."
              className="w-full bg-transparent border border-border pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Category */}
          <label className="block">
            <span className="hud-label block mb-1.5">Categoria</span>
            <select
              value={categoryId}
              onChange={(e) => setParam("categoryId", e.target.value)}
              className="w-full bg-[var(--surface)] border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* Account */}
          <label className="block">
            <span className="hud-label block mb-1.5">Conta</span>
            <select
              value={accountId}
              onChange={(e) => setParam("accountId", e.target.value)}
              className="w-full bg-[var(--surface)] border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todas</option>
              {accs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* Period */}
          <label className="block">
            <span className="hud-label block mb-1.5">De</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setParam("from", e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="hud-label block mb-1.5">Até</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setParam("to", e.target.value)}
              className="w-full bg-transparent border border-border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["month", "Mês"],
                ["30d", "30D"],
                ["90d", "90D"],
                ["year", "Ano"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPeriodPreset(k)}
                className="border border-border px-3 py-2 text-xs uppercase font-mono hover:border-primary hover:text-primary transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex border border-border w-full md:w-fit">
          {(["all", "income", "expense"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setParam("type", k)}
              className={`px-4 py-2 text-xs uppercase tracking-wide font-mono flex-1 md:flex-none ${
                type === k
                  ? k === "expense"
                    ? "bg-[color:var(--flare)] text-white"
                    : "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? "Todas" : k === "income" ? "Receitas" : "Despesas"}
            </button>
          ))}
        </div>
      </BrutalCard>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <div className="bg-background p-4">
          <div className="hud-label">Receitas no recorte</div>
          <div className="font-mono tabular-nums text-lg md:text-xl text-primary mt-1">{brl(totals.income)}</div>
        </div>
        <div className="bg-background p-4">
          <div className="hud-label">Despesas no recorte</div>
          <div className="font-mono tabular-nums text-lg md:text-xl text-[color:var(--flare)] mt-1">{brl(totals.expense)}</div>
        </div>
        <div className="bg-background p-4">
          <div className="hud-label">Saldo</div>
          <div className={`font-mono tabular-nums text-lg md:text-xl mt-1 ${totals.net >= 0 ? "text-primary" : "text-[color:var(--flare)]"}`}>
            {brl(totals.net)}
          </div>
        </div>
      </div>

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
