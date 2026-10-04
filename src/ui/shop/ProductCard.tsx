import Link from "next/link";
import type { ProductCard as Product } from "@/application/catalog.service";
import { formatFcfa } from "@/domain/money";
import { ProductTile } from "../ProductTile";
import { SavingPill } from "../Price";

export function ProductCard({ p }: { p: Product }) {
  const cmp = p.bestComparison;
  return (
    <Link href={`/produits/${p.slug}`} className="group flex flex-col rounded-[var(--radius-card)] bg-gradient-to-b from-white to-sable-50 p-2.5 shadow-[var(--shadow-card)] ring-1 ring-white transition-transform hover:-translate-y-0.5">
      <div className="relative">
        <ProductTile emoji={p.emoji} name={p.name} src={p.image} />
        {/* Raccourci visuel « ajouter » comme sur la vitrine ; la carte entière mène au produit */}
        <span aria-hidden className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-gradient-to-b from-accent-500 to-accent-700 text-white shadow-[0_6px_14px_-6px_rgb(168_66_10/0.8)] ring-2 ring-white">
          <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>
        </span>
      </div>
      <p className="mt-2 line-clamp-2 px-0.5 text-[15px] leading-snug font-bold text-anthracite-900">{p.name}</p>
      {p.brand && <p className="px-0.5 text-xs text-anthracite-600">{p.brand}</p>}
      <div className="mt-auto px-0.5 pt-2">
        {p.fromPrice !== null ? (
          <p className="text-sm">
            <span className="text-xs text-anthracite-600">dès </span>
            <strong className="rounded-lg bg-brand-700 px-2 py-0.5 tabular text-white">{formatFcfa(p.fromPrice)}</strong>
          </p>
        ) : (
          <p className="text-xs font-semibold text-accent-700">En achat groupé</p>
        )}
        {cmp?.saving ? <SavingPill amount={cmp.saving} bps={cmp.savingBps} /> : null}
        {p.openGroupBuy && <p className="capsule-terre mt-1.5 rounded-full px-2 py-0.5 text-center text-xs font-bold">👥 Achat groupé en cours</p>}
      </div>
    </Link>
  );
}
