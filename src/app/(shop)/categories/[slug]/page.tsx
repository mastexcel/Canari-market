import { notFound } from "next/navigation";
import { prisma } from "@/infrastructure/db";
import { searchProducts } from "@/application/catalog.service";
import { PageHeader } from "@/ui/Card";
import { ProductCard } from "@/ui/shop/ProductCard";
import { BackLink } from "@/ui/shop/BackLink";
import { EmptyState } from "@/ui/EmptyState";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) notFound();
  const products = await searchProducts({ categorySlug: slug, take: 100 });
  return (
    <div>
      <PageHeader title={`${category.emoji} ${category.name}`} subtitle={`${products.length} produits`} back={<BackLink href="/categories" />} />
      {products.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <EmptyState title="Bientôt disponible" emoji="📦" />
      )}
    </div>
  );
}
