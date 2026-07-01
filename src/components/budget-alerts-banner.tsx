import { Link } from "@tanstack/react-router";
import { AlertTriangle, Flame, TrendingUp } from "lucide-react";
import { BrutalCard } from "./brutal-card";
import { HudLabel } from "./hud-label";
import { brl } from "@/lib/format";
import type { BudgetAlert, BudgetAlertLevel } from "@/lib/use-budget-alerts";

const META: Record<
  BudgetAlertLevel,
  { label: string; className: string; icon: typeof AlertTriangle }
> = {
  warning: {
    label: "Atenção · 80%",
    className: "text-[color:var(--warn,#F5A524)] border-[color:var(--warn,#F5A524)]",
    icon: AlertTriangle,
  },
  critical: {
    label: "No limite · 100%",
    className: "text-[color:var(--flare)] border-[color:var(--flare)]",
    icon: Flame,
  },
  over: {
    label: "Estourado",
    className: "text-[color:var(--flare)] border-[color:var(--flare)]",
    icon: TrendingUp,
  },
};

export function BudgetAlertsBanner({ alerts }: { alerts: BudgetAlert[] }) {
  if (!alerts.length) return null;

  return (
    <BrutalCard className="p-5 border-l-4 border-l-[color:var(--flare)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-[color:var(--flare)]" />
          <HudLabel bracket={false}>
            ALERTAS DE ORÇAMENTO · {alerts.length.toString().padStart(2, "0")}
          </HudLabel>
        </div>
        <Link
          to="/app/orcamentos"
          className="text-xs uppercase font-mono text-primary hover:underline"
        >
          Gerenciar →
        </Link>
      </div>

      <div className="space-y-2">
        {alerts.slice(0, 5).map((a) => {
          const meta = META[a.level];
          const Icon = meta.icon;
          const pct = Math.min(a.pct, 999);
          const barPct = Math.min(a.pct, 100);
          return (
            <div key={a.categoryId} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">{a.emoji}</span>
                  <span className="font-medium truncate">{a.categoryName}</span>
                  <span
                    className={`hud-label border px-1.5 py-0.5 shrink-0 flex items-center gap-1 ${meta.className}`}
                  >
                    <Icon className="size-3" /> {meta.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  <span className="text-muted-foreground">{brl(a.spent)} / {brl(a.budget)}</span>
                  <span className={a.level === "warning" ? "text-[color:var(--warn,#F5A524)]" : "text-[color:var(--flare)]"}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-background border border-border overflow-hidden">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${barPct}%`,
                    background:
                      a.level === "warning" ? "var(--warn, #F5A524)" : "var(--flare)",
                  }}
                />
                {a.pct > 100 && (
                  <div
                    className="h-full -mt-1.5 bg-[color:var(--flare)] opacity-60 mix-blend-multiply"
                    style={{ width: "100%" }}
                  />
                )}
              </div>
            </div>
          );
        })}
        {alerts.length > 5 && (
          <div className="text-xs font-mono text-muted-foreground uppercase pt-1">
            + {alerts.length - 5} outros alertas
          </div>
        )}
      </div>
    </BrutalCard>
  );
}
