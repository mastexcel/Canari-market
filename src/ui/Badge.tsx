import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "neutral" | "brand" | "accent" | "economie" | "alerte" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-sable-100 text-anthracite-800 ring-1 ring-sable-300",
  brand: "bg-brand-700 text-white",
  accent: "bg-accent-400 text-anthracite-950",
  economie: "bg-economie-700 text-white",
  alerte: "bg-alerte-700 text-white",
  info: "bg-info-700 text-white",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone], className)}>{children}</span>;
}
