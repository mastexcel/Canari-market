import Link from "next/link";
import type { GroupBuyView } from "@/application/group-buy.service";
import { formatFcfa } from "@/domain/money";
import { formatUnits, unitNoun } from "@/domain/units";
import { timeLeft } from "@/domain/dates";
import { GroupProgress } from "../ProgressBar";
import { ProductTile } from "../ProductTile";
import { Badge } from "../Badge";

export function tierMarkers(gb: Pick<GroupBuyView, "tiers" | "targetUnits" | "progress">) {
  const max = Math.max(gb.targetUnits, ...gb.tiers.map((t) => t.minUnits).filter((m) => m <= gb.targetUnits));
  return gb.tiers
    .filter((t) => t.minUnits <= max)
    .map((t) => ({ at: (t.minUnits / gb.targetUnits) * 100, label: `${t.minUnits}`, reached: gb.progress.committedUnits >= t.minUnits }));
}

export function GroupBuyCard({ gb, now = new Date() }: { gb: GroupBuyView; now?: Date }) {
  const p = gb.progress;
  const unit = gb.supplierUnitLabel.toLowerCase();
  return (
    <Link href={`/achats-groupes/${gb.slug}`} className="block rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-float)]">
      <div className="flex gap-3">
        <ProductTile emoji={gb.product.emoji} name={gb.product.name} size="sm" className="size-14 text-3xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold leading-snug text-anthracite-900">{gb.title}</h3>
            {gb.community && <Badge tone="brand">{gb.community.name.replace(/^Sesam /, "")}</Badge>}
          </div>
          <p className="mt-0.5 text-sm text-anthracite-600">
            {gb.referenceIsFresh && <span className="mr-1.5 line-through">{formatFcfa(gb.referenceUnitPrice)}</span>}
            <strong className="text-brand-700">{formatFcfa(p.targetUnitPrice)}</strong> <span className="text-xs">/ {unit}</span>
          </p>
        </div>
      </div>
      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-bold tabular text-anthracite-900">
            {formatUnits(p.committedUnits, 0)} / {gb.targetUnits} <span className="font-normal text-anthracite-600">{unitNoun(gb.supplierUnitLabel, gb.targetUnits)}</span>
          </span>
          <span className="font-extrabold tabular text-brand-700">{Math.floor(p.percentOfTarget)} %</span>
        </div>
        <GroupProgress percent={p.percentOfTarget} markers={tierMarkers(gb)} label={`Progression de ${gb.title}`} />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-anthracite-700">
            {p.remainingToTargetUnits > 0 ? `Plus que ${p.remainingToTargetUnits} pour débloquer le prix` : "Objectif atteint 🎉"}
          </span>
          <span className="shrink-0 text-anthracite-500">⏱ {timeLeft(gb.closesAt, now)}</span>
        </div>
      </div>
    </Link>
  );
}
