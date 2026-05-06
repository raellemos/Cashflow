import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function HudLabel({
  children,
  className,
  bracket = true,
}: {
  children: ReactNode;
  className?: string;
  bracket?: boolean;
}) {
  return (
    <span className={cn("hud-label", bracket && "hud-bracket", className)}>{children}</span>
  );
}
