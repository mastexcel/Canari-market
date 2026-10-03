/**
 * Catalogue : catégories, produits, comparateur de prix, paniers famille.
 */
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { latestReference, referenceFreshness, usableReferencePrice } from "@/domain/reference-price";
import { ratioBps } from "@/domain/money";
import { assertSellable, sellableCategoryWhere } from "@/domain/assortment";
import { assortment } from "@/infrastructure/env";
import { productImage } from "@/infrastructure/assets";

export interface PriceComparison {
  canariPrice: number;
  referencePrice: number | null;
  referenceObservedAt: Date | null;
  referenceSource: string | null;
  referenceMethod: string | null;
  freshness: "fresh" | "stale" | "none";
  saving: number | null;
  savingBps: number | null;
}

/** Comparateur : n'affiche une économie que si le relevé de référence est récent. */
export function comparePrice(
  canariPrice: number,
  refs: ReadonlyArray<{ price: number; observedAt: Date; sourceLabel: string; method: string }>,
  now = new Date(),
): PriceComparison {
  const ref = latestReference(refs);
  if (!ref) {
    return { canariPrice, referencePrice: null, referenceObservedAt: null, referenceSource: null, referenceMethod: null, freshness: "none", saving: null, savingBps: null };
  }
  const usable = usableReferencePrice({ price: ref.price, observedAt: ref.observedAt, source: ref.sourceLabel, method: ref.method }, now);
  const saving = usable !== null ? Math.max(0, usable - canariPrice) : null;
  return {
    canariPrice,
    referencePrice: ref.price,
    referenceObservedAt: ref.observedAt,
    referenceSource: ref.sourceLabel,
    referenceMethod: ref.method,
    freshness: referenceFreshness(ref.observedAt, now),
    saving,
    savingBps: saving !== null && usable ? ratioBps(saving, usable) : null,
  };
}

export async function listCategories(db: Db = prisma) {
  return db.category.findMany({
    where: { ...sellableCategoryWhere(assortment()), parentId: null },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
}

/** Catégories annoncées « bientôt » (phase 2 : périssables). */
export async function upcomingCategories(db: Db = prisma) {
  if (assortment().perishablesEnabled) return [];
  return db.category.findMany({ where: { isActive: true, isPerishable: true, parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, emoji: true } });
}

const variantInclude = {
  referencePrices: { orderBy: { observedAt: "desc" }, take: 1 },
} satisfies Prisma.ProductVariantInclude;

export async function searchProducts(
  params: { q?: string; categorySlug?: string; take?: number; sort?: "popular" | "name" },
  db: Db = prisma,
) {
  const q = params.q?.trim();
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    category: { ...sellableCategoryWhere(assortment()), ...(params.categorySlug ? { slug: params.categorySlug } : {}) },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { brand: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const products = await db.product.findMany({
    where,
    take: Math.min(params.take ?? 40, 100),
    orderBy: params.sort === "name" ? { name: "asc" } : { popularity: "desc" },
    include: {
      category: { select: { name: true, slug: true } },
      variants: { where: { isActive: true }, include: variantInclude, orderBy: { quantityBase: "asc" } },
      groupBuys: { where: { status: "OPEN" }, select: { slug: true, title: true }, take: 1 },
    },
  });
  const now = new Date();
  return products.map((p) => {
    const sellable = p.variants.filter((v) => v.canariPrice !== null);
    const best = sellable
      .map((v) => ({ v, cmp: comparePrice(v.canariPrice!, v.referencePrices, now) }))
      .sort((a, b) => (b.cmp.savingBps ?? -1) - (a.cmp.savingBps ?? -1))[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      emoji: p.emoji,
      image: productImage(p.slug, p.imageUrl),
      category: p.category,
      fromPrice: sellable.length ? Math.min(...sellable.map((v) => v.canariPrice!)) : null,
      bestComparison: best?.cmp ?? null,
      bestVariantName: best?.v.name ?? null,
      openGroupBuy: p.groupBuys[0] ?? null,
    };
  });
}

export type ProductCard = Awaited<ReturnType<typeof searchProducts>>[number];

export async function getProduct(slug: string, db: Db = prisma) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: true,
      variants: { where: { isActive: true }, include: { referencePrices: { orderBy: { observedAt: "desc" }, take: 3 } }, orderBy: { quantityBase: "asc" } },
      groupBuys: { where: { status: "OPEN" }, include: { tiers: true }, take: 3 },
      inventories: true,
      reviews: { orderBy: { createdAt: "desc" }, take: 5, include: { user: { select: { firstName: true } } } },
    },
  });
  if (!product || !product.isActive) throw new DomainError("NOT_FOUND", "Produit introuvable.");
  assertSellable(product.category, assortment());
  const now = new Date();
  const onHand = product.inventories.reduce((s, i) => s + i.quantityBase - i.reservedBase, 0);
  return {
    ...product,
    image: productImage(product.slug, product.imageUrl),
    variants: product.variants.map((v) => ({
      ...v,
      comparison: v.canariPrice !== null ? comparePrice(v.canariPrice, v.referencePrices, now) : null,
      available: Math.max(0, Math.floor(onHand / v.quantityBase)),
    })),
    rating: product.reviews.length ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length : null,
  };
}

/** Meilleures économies du moment (relevés récents uniquement). */
export async function bestSavings(take = 6, db: Db = prisma) {
  const products = await searchProducts({ take: 80 }, db);
  return products
    .filter((p) => p.bestComparison?.savingBps)
    .sort((a, b) => (b.bestComparison!.savingBps ?? 0) - (a.bestComparison!.savingBps ?? 0))
    .slice(0, take);
}

// ─── Paniers famille ─────────────────────────────────────────

export async function listBaskets(db: Db = prisma) {
  const baskets = await db.familyBasket.findMany({
    // Un panier n'est proposé que si tous ses articles sont vendables dans la phase en cours.
    where: { isActive: true, items: { every: { variant: { product: { category: sellableCategoryWhere(assortment()) } } } } },
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        include: { variant: { include: { product: { select: { name: true, emoji: true, slug: true } }, referencePrices: { orderBy: { observedAt: "desc" }, take: 1 } } } },
      },
    },
  });
  const now = new Date();
  return baskets.map((b) => {
    let canariTotal = 0;
    let referenceTotal = 0;
    let referenceComplete = true;
    const items = b.items.map((it) => {
      const price = it.variant.canariPrice ?? 0;
      const ref = it.variant.referencePrices[0];
      const usable = ref ? usableReferencePrice({ price: ref.price, observedAt: ref.observedAt, source: ref.sourceLabel, method: ref.method }, now) : null;
      canariTotal += price * it.quantity;
      if (usable === null) referenceComplete = false;
      referenceTotal += (usable ?? price) * it.quantity;
      return { ...it, unitPrice: price, referenceUnitPrice: usable };
    });
    const saving = Math.max(0, referenceTotal - canariTotal);
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      householdHint: b.householdHint,
      targetPrice: b.targetPrice,
      items,
      canariTotal,
      referenceTotal,
      referenceComplete,
      saving,
      savingBps: ratioBps(saving, referenceTotal),
      oldestReference: b.items.reduce<Date | null>((oldest, it) => {
        const d = it.variant.referencePrices[0]?.observedAt;
        return d && (!oldest || d < oldest) ? d : oldest;
      }, null),
    };
  });
}

export async function getBasket(slug: string, db: Db = prisma) {
  const b = (await listBaskets(db)).find((x) => x.slug === slug);
  if (!b) throw new DomainError("NOT_FOUND", "Panier introuvable.");
  return b;
}
