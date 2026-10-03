import Link from "next/link";
import type { ProductCard as Product } from "@/application/catalog.service";
import { formatFcfa } from "@/domain/money";
import { ProductTile } from "../ProductTile";
import { SavingPill } from "../Price";

export function ProductCard({ p }: { p: Product }) {
  const cmp = p.bestComparison;
  return (
    <Link href={`/produits/${p.slug}`} className="flex flex-col rounded-[var(--radius-card)] bg-white p-3 shadow-[var(--shadow-card)]">
      <ProductTile emoji={p.emoji} name={p.name} />
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-anthracite-900">{p.name}</p>
      {p.brand && <p className="text-xs text-anthracite-500">{p.brand}</p>}
      <div className="mt-auto pt-2">
        {p.fromPrice !== null ? (
          <p className="text-sm">
            <span className="text-xs text-anthracite-500">dès </span>
            <strong className="tabular text-bordeaux-700">{formatFcfa(p.fromPrice)}</strong>
          </p>
        ) : (
          <p className="text-xs font-semibold text-canari-700">En achat groupé</p>
        )}
        {cmp?.saving ? <SavingPill amount={cmp.saving} bps={cmp.savingBps} /> : null}
        {p.openGroupBuy && <p className="mt-1 text-[11px] font-semibold text-bordeaux-600">👥 Achat groupé en cours</p>}
      </div>
    </Link>
  );
}
