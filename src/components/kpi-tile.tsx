import { BrutalCard } from "./brutal-card";
import { HudLabel } from "./hud-label";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  delta,
  tone = "default",
  format = "currency",
}: {
  label: string;
  value: number;
  delta?: string;
  tone?: "default" | "lime" | "flare" | "info";
  format?: "currency" | "number" | "score";
}) {
  const toneClass =
    tone === "lime"
      ? "text-primary"
      : tone === "flare"
        ? "text-[color:var(--flare)]"
        : tone === "info"
          ? "text-[color:var(--info)]"
          : "text-foreground";

  const formatted =
    format === "currency" ? brl(value) : format === "score" ? String(Math.round(value)) : value.toLocaleString("pt-BR");

  return (
    <BrutalCard className="p-5">
      <div className="flex items-center justify-between">
        <HudLabel>{label}</HudLabel>
        {delta && <span className="hud-label text-foreground">{delta}</span>}
      </div>
      <div className={cn("font-display text-3xl md:text-4xl mt-3 tabular-nums", toneClass)}>
        {formatted}
      </div>
    </BrutalCard>
  );
}
