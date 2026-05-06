import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function BrutalCard({
  children,
  className,
  tone = "surface",
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: "surface" | "elevated" | "canvas";
}) {
  const bg =
    tone === "canvas" ? "bg-background" : tone === "elevated" ? "bg-[var(--surface-elevated)]" : "bg-[var(--surface)]";
  return (
    <div
      {...rest}
      className={cn("border border-border", bg, "relative", className)}
    >
      {children}
    </div>
  );
}
