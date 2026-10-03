import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getProduct } from "@/application/catalog.service";
import { track } from "@/application/analytics.service";
import { DomainError } from "@/domain/errors";
import { Card } from "@/ui/Card";
import { ProductTile } from "@/ui/ProductTile";
import { PriceCompare } from "@/ui/Price";
import { BackLink } from "@/ui/shop/BackLink";
import { Badge } from "@/ui/Badge";
import { AddToCart } from "./AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  let product;
  try {
    product = await getProduct(slug);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (user) await track("product_viewed", user.id, { productId: product.id });
  const sellable = product.variants.filter((v) => v.canariPrice !== null);

  return (
    <div className="space-y-4">
      <BackLink href={`/categories/${product.category.slug}`} />
      <ProductTile emoji={product.emoji} name={product.name} src={product.image} size="lg" />
      <div>
        <Badge tone="neutral">{product.category.name}</Badge>
        <h1 className="mt-2 text-2xl font-extrabold">{product.name}</h1>
        {product.brand && <p className="text-sm text-anthracite-600">{product.brand}</p>}
        <p className="mt-2 text-sm text-anthracite-700">{product.description}</p>
        {product.rating !== null && <p className="mt-1 text-sm">⭐ {product.rating.toFixed(1)} / 5</p>}
      </div>

      {product.groupBuys.map((gb) => (
        <Link key={gb.id} href={`/achats-groupes/${gb.slug}`} className="capsule-foret block rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-white">👥 Achat groupé en cours</p>
          <p className="font-bold">{gb.title}</p>
          <p className="mt-1 text-sm font-semibold text-accent-400">Rejoindre et payer moins cher →</p>
        </Link>
      ))}

      {sellable.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-3 font-bold">Disponible en stock Sesam-Market</h2>
          <ul className="space-y-4">
            {sellable.map((v) => (
              <li key={v.id} className="border-b border-gris-200 pb-4 last:border-0 last:pb-0">
                <p className="font-semibold">{v.name}</p>
                <PriceCompare
                  canari={v.canariPrice!}
                  reference={v.comparison?.referencePrice ?? null}
                  observedAt={v.comparison?.referenceObservedAt ?? null}
                  source={v.comparison?.referenceSource}
                  fresh={v.comparison?.freshness === "fresh"}
                  compact
                />
                {v.comparison?.referenceMethod && <p className="text-xs text-anthracite-500">Méthode : {v.comparison.referenceMethod}</p>}
                <div className="mt-2">
                  <AddToCart variantId={v.id} loggedIn={!!user} available={v.available} next={`/produits/${slug}`} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        product.groupBuys.length === 0 && <p className="text-sm text-anthracite-600">Ce produit est vendu uniquement en achat groupé. Le prochain sera annoncé bientôt.</p>
      )}

      {product.reviews.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 font-bold">Avis</h2>
          <ul className="space-y-2 text-sm">
            {product.reviews.map((r) => (
              <li key={r.id}>
                <span className="font-semibold">{r.user.firstName}</span> · {"⭐".repeat(r.rating)}
                {r.comment && <p className="text-anthracite-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
