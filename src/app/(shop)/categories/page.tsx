import Image from "next/image";
import Link from "next/link";
import { categoryImage } from "@/infrastructure/assets";
import { listCategories, upcomingCategories } from "@/application/catalog.service";
import { PageHeader } from "@/ui/Card";

export const metadata = { title: "Catégories" };

export default async function CategoriesPage() {
  const [cats, upcoming] = await Promise.all([listCategories(), upcomingCategories()]);
  return (
    <div>
      <PageHeader title="Catégories" />
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cats.map((c) => (
          <li key={c.id}>
            <Link href={`/categories/${c.slug}`} className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
              {categoryImage(c.slug) ? (
                <Image src={categoryImage(c.slug)!} alt="" width={320} height={200} className="h-24 w-full rounded-xl object-cover" />
              ) : (
                <span className="text-4xl" aria-hidden>
                  {c.emoji}
                </span>
              )}
              <span className="font-bold">{c.name}</span>
              <span className="text-xs text-anthracite-600">{c._count.products} produits</span>
            </Link>
          </li>
        ))}
        {upcoming.map((c) => (
          <li key={c.slug}>
            <div className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-dashed border-gris-300 bg-white/60 p-4">
              <span className="text-4xl grayscale" aria-hidden>
                {c.emoji}
              </span>
              <span className="font-bold text-anthracite-600">{c.name}</span>
              <span className="w-fit rounded-full bg-accent-100 px-2 py-0.5 text-xs font-bold text-accent-700">Bientôt</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-anthracite-600">Sesam-Market démarre avec les produits non périssables : stockables, sans perte ni chaîne du froid, ils permettent de grouper les achats sur plusieurs semaines et d&apos;obtenir les meilleurs prix. Les produits frais suivront.</p>
    </div>
  );
}
