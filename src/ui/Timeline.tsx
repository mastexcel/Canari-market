import type { TimelineStep } from "@/domain/order-status";
import { cn } from "./cn";

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative space-y-0" aria-label="Suivi de commande">
      {steps.map((s, i) => (
        <li key={s.status} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && (
            <span className={cn("absolute top-6 left-[11px] h-[calc(100%-12px)] w-0.5", s.state === "done" ? "bg-bordeaux-600" : "bg-gris-300")} aria-hidden />
          )}
          <span
            className={cn(
              "relative z-10 grid size-6 shrink-0 place-items-center rounded-full border-2 text-xs font-bold",
              s.state === "done" && "border-bordeaux-600 bg-bordeaux-600 text-white",
              s.state === "current" && "border-canari-500 bg-canari-100 text-canari-700 ring-4 ring-canari-100",
              s.state === "upcoming" && "border-gris-300 bg-white text-anthracite-500",
            )}
            aria-hidden
          >
            {s.state === "done" ? "✓" : i + 1}
          </span>
          <span className={cn("pt-0.5 text-sm", s.state === "upcoming" ? "text-anthracite-500" : "font-semibold text-anthracite-900")}>
            {s.label}
            {s.state === "current" && <span className="sr-only"> (étape en cours)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Étapes">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col items-center gap-1" aria-current={i === current ? "step" : undefined}>
          <span className={cn("h-1.5 w-full rounded-full", i <= current ? "bg-bordeaux-600" : "bg-gris-300")} />
          <span className={cn("text-[11px]", i === current ? "font-bold text-bordeaux-700" : "text-anthracite-500")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
