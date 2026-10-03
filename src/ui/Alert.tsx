import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "success" | "warning" | "error";
const styles: Record<Tone, string> = {
  info: "bg-info-100 text-info-700 border-info-700/20",
  success: "bg-economie-100 text-economie-700 border-economie-700/20",
  warning: "bg-accent-100 text-accent-700 border-accent-600/30",
  error: "bg-alerte-100 text-alerte-700 border-alerte-700/20",
};
const icons: Record<Tone, string> = { info: "ℹ️", success: "✅", warning: "⚠️", error: "⛔" };

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-3 text-sm", styles[tone], className)}>
      <span aria-hidden>{icons[tone]}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div>}
      </div>
    </div>
  );
}
