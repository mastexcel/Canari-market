import Image from "next/image";
import Link from "next/link";
import { categoryImage } from "@/infrastructure/assets";

/** Vignette d'un rayon : photo, nom, nombre de produits ou « Bientôt ». */
export function RayonTile({ slug, name, emoji, products }: { slug: string; name: string; emoji: string; products: number }) {
  const img = categoryImage(slug);
  return (
    <Link href={`/categories/${slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-white transition-transform hover:-translate-y-0.5">
      <span className="relative block aspect-[4/3] bg-sable-50">
        {img ? (
          <Image src={img} alt="" fill sizes="(min-width: 1024px) 180px, (min-width: 768px) 22vw, 33vw" className="object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-4xl" aria-hidden>
            {emoji}
          </span>
        )}
        {products === 0 && <span className="absolute top-1.5 right-1.5 rounded-full bg-accent-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">Bientôt</span>}
      </span>
      <span className="flex flex-1 flex-col justify-between gap-0.5 px-2 pt-1.5 pb-2">
        <span className="text-[13px] leading-tight font-bold text-anthracite-900">{name}</span>
        {products > 0 && <span className="text-[11px] font-semibold text-brand-700">{products} produit{products > 1 ? "s" : ""}</span>}
      </span>
    </Link>
  );
}
