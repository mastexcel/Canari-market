import { formatBps, formatFcfa } from "@/domain/money";
import { formatShortDate } from "@/domain/dates";
import { cn } from "./cn";

export function Fcfa({ amount, className }: { amount: number; className?: string }) {
  return <span className={cn("tabular whitespace-nowrap", className)}>{formatFcfa(amount)}</span>;
}

/** Bloc comparateur : référence datée et sourcée, prix Sesam-Market, économie. */
export function PriceCompare({
  canari,
  reference,
  observedAt,
  source,
  fresh,
  compact,
}: {
  canari: number;
  reference: number | null;
  observedAt: Date | null;
  source?: string | null;
  fresh: boolean;
  compact?: boolean;
}) {
  const saving = reference !== null && fresh ? Math.max(0, reference - canari) : null;
  const bps = saving !== null && reference ? Math.round((saving * 10_000) / reference) : null;
  return (
    <div className={cn("space-y-1", compact && "text-sm")}>
      {reference !== null && (
        <p className="text-anthracite-600">
          Prix marché indicatif :{" "}
          <span className={cn("tabular", fresh ? "line-through" : "")}>{formatFcfa(reference)}</span>
          {observedAt && (
            <span className="block text-xs text-anthracite-500">
              {fresh ? "Relevé du" : "⚠️ Relevé ancien du"} {formatShortDate(observedAt)}
              {source ? ` · ${source}` : ""}
            </span>
          )}
        </p>
      )}
      <p className="text-anthracite-900">
        Prix Sesam-Market : <strong className="tabular text-brand-700">{formatFcfa(canari)}</strong>
      </p>
      {saving !== null && saving > 0 && (
        <p className="font-semibold text-economie-700">
          Économie : <span className="tabular">{formatFcfa(saving)}</span> ({formatBps(bps!)})
        </p>
      )}
      {reference !== null && !fresh && <p className="text-xs text-accent-700">Économie non affichée : prix de référence à actualiser.</p>}
    </div>
  );
}

export function SavingPill({ amount, bps }: { amount: number; bps?: number | null }) {
  if (amount <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-economie-100 px-2 py-0.5 text-xs font-bold text-economie-700">
      −{formatFcfa(amount)}
      {bps ? ` · ${formatBps(bps, 0)}` : ""}
    </span>
  );
}
