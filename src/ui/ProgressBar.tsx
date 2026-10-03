import { cn } from "./cn";

/**
 * Barre de progression d'achat groupé : très visible, avec repères de paliers.
 */
export function GroupProgress({
  percent,
  markers = [],
  size = "md",
  label,
}: {
  percent: number;
  markers?: Array<{ at: number; label: string; reached: boolean }>;
  size?: "sm" | "md" | "lg";
  label: string;
}) {
  const p = Math.max(0, Math.min(100, percent));
  const h = size === "lg" ? "h-5" : size === "md" ? "h-3.5" : "h-2.5";
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p)}
        className={cn("relative w-full overflow-hidden rounded-full bg-gris-200", h)}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-700", p >= 100 ? "bg-economie-600" : "bg-gradient-to-r from-brand-600 via-lime-500 to-accent-500")}
          style={{ width: `${p}%` }}
        />
        {markers.map((m) => (
          <span
            key={m.at}
            className={cn("absolute top-0 h-full w-0.5", m.reached ? "bg-white/70" : "bg-anthracite-500/40")}
            style={{ left: `${Math.min(99.5, m.at)}%` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}
