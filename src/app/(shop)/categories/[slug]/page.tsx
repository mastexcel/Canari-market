import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/db";
import { searchProducts } from "@/application/catalog.service";
import { categoryImage } from "@/infrastructure/assets";
import { PageHeader } from "@/ui/Card";
import { ProductCard } from "@/ui/shop/ProductCard";
import { RayonTile } from "@/ui/shop/RayonTile";
import { BackLink } from "@/ui/shop/BackLink";
import { EmptyState } from "@/ui/EmptyState";
import { ButtonLink } from "@/ui/Button";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      parent: { select: { slug: true } },
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { _count: { select: { products: { where: { isActive: true } } } } } },
    },
  });
  if (!category || !category.isActive) notFound();
  const products = await searchProducts({ categorySlug: slug, take: 100 });
  const open = products.length > 0;
  return (
    <div>
      <PageHeader title={category.name} subtitle={open ? `${products.length} produit${products.length > 1 ? "s" : ""}` : "Bientôt disponible"} back={<BackLink href={category.parent ? `/categories/${category.parent.slug}` : "/categories"} />} />
      {category.children.length > 0 && (
        <ul className="mb-6 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6" aria-label="Rayons">
          {category.children.map((r) => (
            <li key={r.slug}>
              <RayonTile slug={r.slug} name={r.name} emoji={r.emoji} products={open ? r._count.products : 0} />
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <EmptyState title="Ce rayon arrive bientôt" image={categoryImage(slug)} emoji={category.emoji} action={<ButtonLink href="/achats-groupes">Voir les achats groupés ouverts</ButtonLink>}>
          Sesam-Market ouvre ses rayons au fur et à mesure : dès qu&apos;un achat groupé est lancé ici, vous le verrez sur cette page.
        </EmptyState>
      )}
    </div>
  );
}
