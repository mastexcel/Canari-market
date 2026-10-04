import { searchProducts } from "@/application/catalog.service";
import { PageHeader } from "@/ui/Card";
import { ProductCard } from "@/ui/shop/ProductCard";
import { EmptyState } from "@/ui/EmptyState";

export const metadata = { title: "Recherche" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.slice(0, 60) ?? "";
  const results = q ? await searchProducts({ q, take: 40 }) : [];
  return (
    <div>
      <PageHeader title="Rechercher" />
      <form role="search" className="mb-4">
        <label htmlFor="q" className="sr-only">
          Produit
        </label>
        <input id="q" name="q" type="search" defaultValue={q} autoFocus placeholder="Riz, huile, lessive…" className="h-12 w-full rounded-xl border border-gris-300 bg-white px-4" />
      </form>
      {q && (
        <p className="mb-3 text-sm text-anthracite-600">
          {results.length} résultat{results.length > 1 ? "s" : ""} pour « {q} »
        </p>
      )}
      {q && results.length === 0 ? (
        <EmptyState title="Aucun produit trouvé" emoji="🔎">
          Essayez un autre mot (ex. « riz », « savon »).
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {results.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
