import type { MetadataRoute } from "next";
import { prisma } from "@/infrastructure/db";
import { sellableCategoryWhere } from "@/domain/assortment";
import { assortment } from "@/infrastructure/env";
import { siteUrl } from "@/lib/site-url";

// Régénéré au plus toutes les heures (achats groupés et catalogue évoluent).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const statics = ["", "/achats-groupes", "/categories", "/points-relais", "/communautes", "/support", "/inscription", "/connexion", "/confidentialite", "/cgu", "/mentions-legales"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/achats-groupes" ? ("daily" as const) : ("monthly" as const),
    priority: p === "" ? 1 : 0.6,
  }));
  try {
    const sellable = sellableCategoryWhere(assortment());
    const [groupBuys, categories, products, baskets] = await Promise.all([
      prisma.groupBuy.findMany({ where: { status: "OPEN" }, select: { slug: true, updatedAt: true } }),
      prisma.category.findMany({ where: { ...sellable, parentId: null }, select: { slug: true } }),
      prisma.product.findMany({ where: { isActive: true, category: sellable }, select: { slug: true, updatedAt: true } }),
      prisma.familyBasket.findMany({ where: { isActive: true }, select: { slug: true } }),
    ]);
    return [
      ...statics,
      ...groupBuys.map((g) => ({ url: `${base}/achats-groupes/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "daily" as const, priority: 0.9 })),
      ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...products.map((p) => ({ url: `${base}/produits/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
      ...baskets.map((b) => ({ url: `${base}/paniers-famille/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ];
  } catch {
    // Base indisponible (build) : on publie au moins les pages fixes.
    return statics;
  }
}
