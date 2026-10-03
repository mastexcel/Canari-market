import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "brand" | "accent" | "economie" | "alerte" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-gris-200 text-anthracite-800",
  brand: "bg-brand-100 text-brand-800",
  accent: "bg-accent-100 text-accent-700",
  economie: "bg-economie-100 text-economie-700",
  alerte: "bg-alerte-100 text-alerte-700",
  info: "bg-info-100 text-info-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}
