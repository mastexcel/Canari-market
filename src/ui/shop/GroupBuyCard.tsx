import Link from "next/link";
import type { GroupBuyView } from "@/application/group-buy.service";
import { formatFcfa } from "@/domain/money";
import { formatUnits, unitNoun } from "@/domain/units";
import { timeLeft } from "@/domain/dates";
import { GroupProgress } from "../ProgressBar";
import { ProductTile } from "../ProductTile";

export function tierMarkers(gb: Pick<GroupBuyView, "tiers" | "targetUnits" | "progress">) {
  const max = Math.max(gb.targetUnits, ...gb.tiers.map((t) => t.minUnits).filter((m) => m <= gb.targetUnits));
  return gb.tiers
    .filter((t) => t.minUnits <= max)
    .map((t) => ({ at: (t.minUnits / gb.targetUnits) * 100, label: `${t.minUnits}`, reached: gb.progress.committedUnits >= t.minUnits }));
}

/** Teinte de l'en-tête : alternée selon la position dans la liste pour varier les couleurs. */
const HEADS = ["capsule-foret", "capsule-terre", "capsule-lagune", "capsule-nuit"] as const;

export function GroupBuyCard({ gb, index = 0, now = new Date() }: { gb: GroupBuyView; index?: number; now?: Date }) {
  const p = gb.progress;
  const unit = gb.supplierUnitLabel.toLowerCase();
  return (
    <Link href={`/achats-groupes/${gb.slug}`} className="group block overflow-hidden rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)] transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      {/* En-tête coloré à motif : produit, titre, prix */}
      <div className={`${HEADS[index % HEADS.length]} flex gap-3 p-4`}>
        <span className="shrink-0 self-start rounded-2xl bg-white p-0.5 shadow-sm ring-2 ring-white/50">
          <ProductTile emoji={gb.product.emoji} name={gb.product.name} src={gb.image} size="sm" className="size-16 text-3xl" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="leading-snug font-bold">{gb.title}</h3>
            {gb.community && <span className="shrink-0 rounded-full bg-white/18 px-2.5 py-0.5 text-xs font-bold ring-1 ring-white/30">{gb.community.name.replace(/^Sesam /, "")}</span>}
          </div>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
            {gb.referenceIsFresh && <span className="text-sm line-through opacity-80">{formatFcfa(gb.referenceUnitPrice)}</span>}
            <strong className="rounded-lg bg-white px-2 py-0.5 text-base font-extrabold text-brand-800 tabular">{formatFcfa(p.targetUnitPrice)}</strong>
            <span className="text-xs opacity-90">/ {unit}</span>
          </p>
        </div>
      </div>
      <div className="p-4 pt-3">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="font-bold tabular text-anthracite-900">
            {formatUnits(p.committedUnits, 0)} / {gb.targetUnits} <span className="font-normal text-anthracite-600">{unitNoun(gb.supplierUnitLabel, gb.targetUnits)}</span>
          </span>
          <span className="rounded-full bg-brand-700 px-2 py-0.5 text-xs font-extrabold tabular text-white">{Math.floor(p.percentOfTarget)} %</span>
        </div>
        <GroupProgress percent={p.percentOfTarget} markers={tierMarkers(gb)} label={`Progression de ${gb.title}`} />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-terre-700">
            {p.remainingToTargetUnits > 0 ? `Plus que ${p.remainingToTargetUnits} pour débloquer le prix` : "Objectif atteint 🎉"}
          </span>
          <span className="shrink-0 rounded-full bg-sable-100 px-2 py-0.5 font-semibold text-anthracite-700">⏱ {timeLeft(gb.closesAt, now)}</span>
        </div>
      </div>
    </Link>
  );
}
