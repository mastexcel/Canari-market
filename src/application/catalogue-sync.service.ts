/**
 * Met la base au niveau de l'arborescence du catalogue (univers et rayons),
 * puis range chaque produit encore placé directement dans un univers dans
 * son rayon. Idempotent : peut être relancé à chaque déploiement.
 */
import { prisma, type Db } from "@/infrastructure/db";
import { RAYONS, UNIVERS, rayonFor } from "@/domain/catalogue-taxonomy";

export async function syncCatalogue(db: Db = prisma) {
  const ids = new Map<string, { id: string; isPerishable: boolean }>();
  for (const [i, u] of UNIVERS.entries()) {
    const c = await db.category.upsert({
      where: { slug: u.slug },
      update: { name: u.name, emoji: u.emoji, sortOrder: i, isPerishable: u.isPerishable, parentId: null },
      create: { slug: u.slug, name: u.name, emoji: u.emoji, sortOrder: i, isPerishable: u.isPerishable },
    });
    ids.set(u.slug, { id: c.id, isPerishable: u.isPerishable });
  }
  const rayonIds = new Map<string, string>();
  for (const [i, r] of RAYONS.entries()) {
    const parent = ids.get(r.parent)!;
    const c = await db.category.upsert({
      where: { slug: r.slug },
      update: { name: r.name, emoji: r.emoji, sortOrder: i, parentId: parent.id, isPerishable: parent.isPerishable },
      create: { slug: r.slug, name: r.name, emoji: r.emoji, sortOrder: i, parentId: parent.id, isPerishable: parent.isPerishable },
    });
    rayonIds.set(r.slug, c.id);
  }
  // Produits encore rangés directement dans un univers
  const loose = await db.product.findMany({
    where: { category: { slug: { in: UNIVERS.map((u) => u.slug) } } },
    select: { id: true, slug: true, category: { select: { slug: true } } },
  });
  let moved = 0;
  for (const p of loose) {
    const rayon = rayonFor(p.slug, p.category.slug);
    if (!rayon) continue;
    await db.product.update({ where: { id: p.id }, data: { categoryId: rayonIds.get(rayon.slug)! } });
    moved++;
  }
  return { univers: UNIVERS.length, rayons: RAYONS.length, moved };
}
