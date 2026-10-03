/**
 * Panier : lignes d'achats groupés (portions) et de stock (unités), toujours
 * re-tarifées au moment de l'affichage.
 */
import { prisma, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { computeProgress } from "@/domain/group-buy";
import { assertSellable, isSellable } from "@/domain/assortment";
import { assortment } from "@/infrastructure/env";
import { productImage } from "@/infrastructure/assets";
import { priceGroupPortion, priceVariant, toGroupBuyState, type LinePrice } from "./pricing.service";
import { track } from "./analytics.service";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      groupBuy: { include: { tiers: true, product: { select: { name: true, emoji: true, slug: true, baseUnit: true, variants: { select: { quantityBase: true, weightGrams: true }, take: 1 } } } } },
      portion: true,
      variant: { include: { referencePrices: { orderBy: { observedAt: "desc" as const }, take: 1 }, product: { select: { id: true, name: true, emoji: true, slug: true, category: { select: { isPerishable: true, isActive: true } } } } } },
    },
  },
};

export interface CartLine {
  id: string;
  kind: "GROUP_BUY" | "STOCK";
  label: string;
  sublabel: string;
  emoji: string;
  image: string | null;
  href: string;
  quantity: number;
  weightGrams: number;
  price: LinePrice | null;
  lineTotal: number;
  groupBuyId?: string;
  expectedDeliveryAt?: Date;
  closesAt?: Date;
  percent?: number;
  issue: string | null;
}

/**
 * Poids logistique d'une portion : exact pour les produits au gramme ; pour les
 * produits au litre ou à la pièce, déduit du poids d'une variante de référence.
 */
export function portionWeightGrams(
  product: { baseUnit: string; variants: Array<{ quantityBase: number; weightGrams: number }> },
  portionBase: number,
): number {
  if (product.baseUnit === "GRAM") return portionBase;
  const v = product.variants[0];
  if (!v || v.quantityBase <= 0) return portionBase;
  return Math.round((portionBase * v.weightGrams) / v.quantityBase);
}

export async function getOrCreateCart(userId: string, db: Db = prisma) {
  const existing = await db.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  const cart = await db.cart.create({ data: { userId } });
  await track("cart_created", userId, {}, db);
  return cart;
}

async function stockAvailable(productId: string, db: Db): Promise<number> {
  const inv = await db.inventory.findMany({ where: { productId } });
  return inv.reduce((s, i) => s + i.quantityBase - i.reservedBase, 0);
}

export async function getCart(userId: string, db: Db = prisma, now = new Date()) {
  const cart = await db.cart.findUnique({ where: { userId }, include: cartInclude });
  const lines: CartLine[] = [];
  for (const it of cart?.items ?? []) {
    if (it.kind === "GROUP_BUY" && it.groupBuy && it.portion) {
      const gb = it.groupBuy;
      const open = gb.status === "OPEN" && now < gb.closesAt && now >= gb.opensAt;
      const price = open ? priceGroupPortion(gb, it.portion, now) : null;
      const progress = computeProgress(toGroupBuyState(gb));
      lines.push({
        id: it.id,
        kind: "GROUP_BUY",
        label: gb.product.name,
        sublabel: `Achat groupé · portion ${it.portion.label}`,
        emoji: gb.product.emoji,
        image: productImage(gb.product.slug),
        href: `/achats-groupes/${gb.slug}`,
        quantity: it.quantity,
        weightGrams: portionWeightGrams(gb.product, it.portion.quantityBase) * it.quantity,
        price,
        lineTotal: price ? (price.unitPrice + price.fractionationFee) * it.quantity : 0,
        groupBuyId: gb.id,
        expectedDeliveryAt: gb.expectedDeliveryAt,
        closesAt: gb.closesAt,
        percent: progress.percentOfTarget,
        issue: open ? null : "Cet achat groupé est clôturé : retirez cette ligne.",
      });
    } else if (it.kind === "STOCK" && it.variant) {
      const v = it.variant;
      const price = v.isActive ? priceVariant(v, now) : null;
      const available = await stockAvailable(v.productId, db);
      const enough = available >= v.quantityBase * it.quantity;
      lines.push({
        id: it.id,
        kind: "STOCK",
        label: v.product.name,
        sublabel: v.name,
        emoji: v.product.emoji,
        image: productImage(v.product.slug),
        href: `/produits/${v.product.slug}`,
        quantity: it.quantity,
        weightGrams: v.weightGrams * it.quantity,
        price,
        lineTotal: price ? price.unitPrice * it.quantity : 0,
        issue: !isSellable(v.product.category, assortment())
          ? "Bientôt disponible : retirez cette ligne."
          : !price
            ? "Produit indisponible."
            : enough
              ? null
              : `Stock insuffisant (max ${Math.floor(available / v.quantityBase)}).`,
      });
    }
  }
  const valid = lines.filter((l) => !l.issue && l.price);
  return {
    id: cart?.id ?? null,
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotal: valid.reduce((s, l) => s + l.lineTotal, 0),
    savings: valid.reduce((s, l) => s + Math.max(0, l.price!.referenceUnitPrice - l.price!.unitPrice - l.price!.fractionationFee) * l.quantity, 0),
    hasIssues: lines.some((l) => l.issue),
  };
}

export type CartView = Awaited<ReturnType<typeof getCart>>;

export async function addToCart(
  userId: string,
  item: { kind: "GROUP_BUY"; portionId: string; quantity: number } | { kind: "STOCK"; variantId: string; quantity: number },
  db: Db = prisma,
) {
  const cart = await getOrCreateCart(userId, db);
  if (item.kind === "GROUP_BUY") {
    const portion = await db.groupBuyPortion.findUnique({ where: { id: item.portionId }, include: { groupBuy: { include: { product: { include: { category: true } } } } } });
    if (!portion) throw new DomainError("NOT_FOUND", "Portion introuvable.");
    assertSellable(portion.groupBuy.product.category, assortment());
    if (portion.groupBuy.status !== "OPEN" || portion.groupBuy.closesAt <= new Date()) {
      throw new DomainError("INVALID_STATE", "Cet achat groupé n'accepte plus de participations.");
    }
    await db.cartItem.upsert({
      where: { cartId_portionId: { cartId: cart.id, portionId: portion.id } },
      create: { cartId: cart.id, kind: "GROUP_BUY", groupBuyId: portion.groupBuyId, portionId: portion.id, quantity: item.quantity },
      update: { quantity: { increment: item.quantity } },
    });
  } else {
    const variant = await db.productVariant.findUnique({ where: { id: item.variantId }, include: { product: { include: { category: true } } } });
    if (!variant || !variant.isActive || variant.canariPrice === null) throw new DomainError("NOT_FOUND", "Produit indisponible.");
    assertSellable(variant.product.category, assortment());
    await db.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      create: { cartId: cart.id, kind: "STOCK", variantId: variant.id, quantity: item.quantity },
      update: { quantity: { increment: item.quantity } },
    });
  }
  // Plafond de sécurité par ligne
  await db.cartItem.updateMany({ where: { cartId: cart.id, quantity: { gt: 50 } }, data: { quantity: 50 } });
  await db.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date() } });
}

export async function updateCartItem(userId: string, itemId: string, quantity: number, db: Db = prisma) {
  const item = await db.cartItem.findFirst({ where: { id: itemId, cart: { userId } } });
  if (!item) throw new DomainError("NOT_FOUND", "Ligne introuvable.");
  if (quantity === 0) await db.cartItem.delete({ where: { id: item.id } });
  else await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
}

export async function addBasketToCart(userId: string, basketSlug: string, db: Db = prisma) {
  const basket = await db.familyBasket.findUnique({ where: { slug: basketSlug }, include: { items: true } });
  if (!basket || !basket.isActive) throw new DomainError("NOT_FOUND", "Panier famille introuvable.");
  for (const it of basket.items) {
    await addToCart(userId, { kind: "STOCK", variantId: it.variantId, quantity: it.quantity }, db);
  }
}

export async function clearCart(userId: string, db: Db = prisma) {
  await db.cartItem.deleteMany({ where: { cart: { userId } } });
}

export async function cartCount(userId: string, db: Db = prisma) {
  const agg = await db.cartItem.aggregate({ where: { cart: { userId } }, _sum: { quantity: true } });
  return agg._sum.quantity ?? 0;
}
