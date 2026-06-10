import { createFileRoute } from "@tanstack/react-router";
import { errMsg } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/server/data.fn";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { HudLabel } from "@/components/hud-label";
import { BrutalCard } from "@/components/brutal-card";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/categories")({
  head: () => ({ meta: [{ title: "Categorias — CashFlow" }] }),
  component: CategoriesPage,
});

type Category = { id: string; name: string; emoji: string; color: string; kind: string };

const PALETTE = ["#D1FF00", "#0099FF", "#ED4609", "#9C9C9C", "#F4F4E8", "#22C55E", "#A855F7"];

function CategoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", user?.id],
    enabled: !!user,
    queryFn: async () => (await listCategories()) as Category[],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteCategory({ data: { id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria removida");
    },
  });

  const groups = {
    income: cats.filter((c) => c.kind === "income"),
    expense: cats.filter((c) => c.kind === "expense"),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <HudLabel>TAXONOMIA</HudLabel>
          <h1 className="font-display text-3xl md:text-5xl uppercase mt-1">Categorias</h1>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 text-xs uppercase tracking-wider font-medium"
        >
          <Plus className="size-4" /> Nova
        </button>
      </div>

      {(["expense", "income"] as const).map((kind) => (
        <div key={kind} className="space-y-3">
          <HudLabel>{kind === "income" ? "RECEITAS" : "DESPESAS"}</HudLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {groups[kind].map((c) => (
              <BrutalCard key={c.id} className="p-4 group relative">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 flex items-center justify-center text-xl border border-border"
                    style={{ background: `${c.color}20` }}
                  >
                    {c.emoji}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="hud-label" style={{ fontSize: 9 }}>
                      {kind === "income" ? "RECEITA" : "DESPESA"}
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => {
                      setEditing(c);
                      setOpen(true);
                    }}
                    className="p-1 hover:text-primary"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => confirm("Remover categoria?") && del.mutate(c.id)}
                    className="p-1 hover:text-[color:var(--flare)]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </BrutalCard>
            ))}
            {groups[kind].length === 0 && (
              <div className="col-span-full p-6 text-center font-mono text-xs text-muted-foreground uppercase border border-dashed border-border">
                [ NENHUMA CATEGORIA ]
              </div>
            )}
          </div>
        </div>
      ))}

      {open && user && (
        <CatModal
          cat={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["categories"] });
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CatModal({
  cat,
  onClose,
  onSaved,
}: {
  cat: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(cat?.name ?? "");
  const [emoji, setEmoji] = useState(cat?.emoji ?? "💸");
  const [color, setColor] = useState(cat?.color ?? "#D1FF00");
  const [kind, setKind] = useState<"income" | "expense">(
    cat?.kind === "income" ? "income" : "expense",
  );
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const data = { name, emoji, color, kind };
    try {
      if (cat) await updateCategory({ data: { id: cat.id, data } });
      else await createCategory({ data });
      toast.success("Categoria salva");
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
        className="relative w-full max-w-md border border-border bg-[var(--surface)] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase">{cat ? "Editar" : "Nova"} categoria</h2>
          <button type="button" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <label className="block">
          <span className="hud-label block mb-1.5">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="hud-label block mb-1.5">Emoji</span>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={2}
              className="w-full bg-transparent border border-border px-3 py-2.5 text-2xl text-center focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="hud-label block mb-1.5">Tipo</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value === "income" ? "income" : "expense")}
              className="w-full bg-[var(--surface)] border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </label>
        </div>
        <div>
          <span className="hud-label block mb-1.5">Cor</span>
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`size-8 border-2 ${color === c ? "border-primary" : "border-border"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
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
