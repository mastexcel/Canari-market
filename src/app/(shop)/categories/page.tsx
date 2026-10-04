import Link from "next/link";
import { catalogueTree } from "@/application/catalog.service";
import { PageHeader } from "@/ui/Card";
import { RayonTile } from "@/ui/shop/RayonTile";

export const metadata = { title: "Tous nos rayons" };

export default async function CategoriesPage() {
  const tree = await catalogueTree();
  return (
    <div>
      <PageHeader title="Tous nos rayons" subtitle="Ce que Sesam-Market vend aujourd'hui, et ce qui arrive bientôt." />
      <div className="space-y-7">
        {tree.map((u) => (
          <section key={u.slug} aria-labelledby={`u-${u.slug}`}>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 id={`u-${u.slug}`} className="flex items-center gap-2 text-lg font-bold text-anthracite-900">
                <span aria-hidden className="h-5 w-1.5 rounded-full bg-gradient-to-b from-accent-400 to-accent-600" />
                {u.name}
              </h2>
              {u.open ? (
                <Link href={`/categories/${u.slug}`} className="pill-action">
                  Tout voir
                </Link>
              ) : (
                <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-800">Bientôt</span>
              )}
            </div>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {u.rayons.map((r) => (
                <li key={r.slug}>
                  <RayonTile {...r} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-anthracite-600">Sesam-Market démarre avec les produits non périssables : stockables, sans perte ni chaîne du froid, ils permettent de grouper les achats sur plusieurs semaines et d&apos;obtenir les meilleurs prix. Les nouveaux rayons ouvrent au fur et à mesure des achats groupés.</p>
    </div>
  );
}
