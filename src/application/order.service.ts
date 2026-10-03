/**
 * OrderService : devis, passage de commande, paiement confirmé, annulation,
 * cycle de vie des lignes et dérivation du statut.
 */
import { Prisma, type OrderStatus } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { humanCode, numericCode } from "@/infrastructure/crypto";
import { DomainError, invariant } from "@/domain/errors";
import { assertCanJoin, computeProgress } from "@/domain/group-buy";
import { computeCheckoutTotals, type PromotionRule } from "@/domain/checkout";
import {
  BULKY_ITEM_WEIGHT_G,
  computeDriverFee,
  computeHomeDeliveryFee,
  computePickupFee,
  generateSlots,
  isValidSlot,
  NO_BENEFITS,
  type DeliveryBenefits,
  type FeeBreakdown,
} from "@/domain/delivery";
import { buildTimeline, deriveOrderStatus, statusRank } from "@/domain/order-status";
import { formatUnits } from "@/domain/units";
import type { CheckoutInput } from "./schemas";
import { getCart, clearCart } from "./cart.service";
import { toGroupBuyState } from "./pricing.service";
import { notify } from "./notification.service";
import { track } from "./analytics.service";
import { bestCommunityForUser } from "./community.service";
import { creditBalance } from "./credit.service";

const DAY = 86_400_000;

// ─── Devis ───────────────────────────────────────────────────

async function resolveDestination(userId: string, input: CheckoutInput, db: Db) {
  if (input.fulfillmentMode === "PICKUP") {
    const point = await db.pickupPoint.findFirst({ where: { id: input.pickupPointId, isActive: true } });
    if (!point) throw new DomainError("VALIDATION", "Point relais introuvable.");
    return { mode: "PICKUP" as const, point, commune: point.commune, address: null };
  }
  let commune: string;
  let address: { id: string } | null = null;
  if (input.addressId) {
    const a = await db.address.findFirst({ where: { id: input.addressId, userId } });
    if (!a) throw new DomainError("VALIDATION", "Adresse introuvable.");
    commune = a.commune;
    address = a;
  } else {
    commune = input.newAddress!.commune;
  }
  const zone = await db.deliveryZone.findFirst({ where: { commune, isActive: true } });
  if (!zone) throw new DomainError("VALIDATION", `La livraison à domicile n'est pas encore disponible à ${commune}. Choisissez un point relais.`);
  return { mode: "HOME_DELIVERY" as const, zone, commune, address, point: null };
}

export async function quoteCheckout(userId: string, input: CheckoutInput, db: Db = prisma, now = new Date()) {
  const cart = await getCart(userId, db, now);
  if (cart.lines.length === 0) throw new DomainError("VALIDATION", "Votre panier est vide.");
  const blocking = cart.lines.find((l) => l.issue);
  if (blocking) throw new DomainError("INVALID_STATE", `${blocking.label} : ${blocking.issue}`);

  const dest = await resolveDestination(userId, input, db);
  const community = await bestCommunityForUser(userId, db, now);
  const benefits: DeliveryBenefits = community
    ? {
        pickupFeeWaived: community.level.benefits.pickupFeeWaived && dest.mode === "PICKUP" && dest.point.id === community.pickupPointId,
        homeDiscountBps: community.level.benefits.homeDiscountBps,
      }
    : NO_BENEFITS;

  const weightGrams = cart.lines.reduce((s, l) => s + l.weightGrams, 0);
  const bulkyItems = cart.lines.reduce((s, l) => s + (l.weightGrams / l.quantity >= BULKY_ITEM_WEIGHT_G ? l.quantity : 0), 0);
  const fee: FeeBreakdown =
    dest.mode === "PICKUP"
      ? computePickupFee(dest.point.customerFee, benefits)
      : computeHomeDeliveryFee(dest.zone, { weightGrams, bulkyItems, speed: input.deliverySpeed }, benefits);

  const groupDates = cart.lines.filter((l) => l.expectedDeliveryAt).map((l) => l.expectedDeliveryAt!.getTime());
  const readyAt = new Date(Math.max(now.getTime() + DAY, ...groupDates));
  const slots = generateSlots(readyAt, 5);

  let promotion: (PromotionRule & { id: string }) | null = null;
  if (input.promoCode) {
    const p = await db.promotion.findUnique({ where: { code: input.promoCode.toUpperCase() } });
    if (!p) throw new DomainError("VALIDATION", "Code promo inconnu.");
    promotion = p;
  }
  const available = await creditBalance(userId, db);
  const totals = computeCheckoutTotals({
    lines: cart.lines.map((l) => ({
      quantity: l.quantity,
      unitPrice: l.price!.unitPrice,
      referenceUnitPrice: l.price!.referenceUnitPrice,
      fractionationFee: l.price!.fractionationFee,
    })),
    deliveryFee: fee.total,
    promotion,
    availableCredit: available,
    useCredit: input.useCredit,
    now,
  });

  return {
    cart,
    destination: dest,
    community,
    benefits,
    fee,
    weightGrams,
    readyAt,
    slots,
    promotion,
    creditAvailable: available,
    totals,
    hasGroupItems: cart.lines.some((l) => l.kind === "GROUP_BUY"),
  };
}

// ─── Passage de commande ─────────────────────────────────────

async function uniqueOrderNumber(db: Db, now: Date) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  for (let i = 0; i < 10; i++) {
    const n = `SES-${d}-${humanCode(5)}`;
    if (!(await db.order.findUnique({ where: { number: n }, select: { id: true } }))) return n;
  }
  throw new Error("Numéro de commande indisponible.");
}

export async function defaultWarehouse(db: Db) {
  const w = await db.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (!w) throw new DomainError("INVALID_STATE", "Aucun entrepôt actif configuré.");
  return w;
}

export async function placeOrder(
  userId: string,
  input: CheckoutInput,
  idempotencyKey: string | null,
  db: Db = prisma,
  now = new Date(),
) {
  if (idempotencyKey) {
    const existing = await db.order.findUnique({ where: { idempotencyKey: `${userId}:${idempotencyKey}` } });
    if (existing) {
      if (existing.userId !== userId) throw new DomainError("CONFLICT", "Clé d'idempotence déjà utilisée.");
      return existing;
    }
  }

  const order = await inTransaction(db, async (tx) => {
    const cartRaw = await tx.cart.findUnique({ where: { userId }, include: { items: true } });
    const gbIds = [...new Set((cartRaw?.items ?? []).map((i) => i.groupBuyId).filter((x): x is string => !!x))];
    // Verrouillage des achats groupés concernés : empêche le dépassement de capacité en cas de commandes concurrentes.
    if (gbIds.length) await tx.$queryRaw`SELECT id FROM "GroupBuy" WHERE id IN (${Prisma.join(gbIds)}) FOR UPDATE`;
    const productIds = [
      ...new Set(
        (await tx.productVariant.findMany({ where: { id: { in: (cartRaw?.items ?? []).map((i) => i.variantId).filter((x): x is string => !!x) } }, select: { productId: true } })).map(
          (v) => v.productId,
        ),
      ),
    ];
    if (productIds.length) await tx.$queryRaw`SELECT id FROM "Inventory" WHERE "productId" IN (${Prisma.join(productIds)}) FOR UPDATE`;

    const q = await quoteCheckout(userId, input, tx, now);

    // Contrôle de capacité par achat groupé (somme des lignes)
    const perGroup = new Map<string, number>();
    for (const l of q.cart.lines) {
      if (l.kind === "GROUP_BUY") perGroup.set(l.groupBuyId!, (perGroup.get(l.groupBuyId!) ?? 0) + l.weightGrams);
    }
    for (const [gbId, qty] of perGroup) {
      const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: gbId }, include: { tiers: true } });
      assertCanJoin(toGroupBuyState(gb), qty, now);
    }

    // Créneau
    let slotStart: Date;
    let slotEnd: Date;
    if (input.deliverySpeed === "SCHEDULED" && input.fulfillmentMode === "HOME_DELIVERY") {
      slotStart = new Date(input.slotStart!);
      slotEnd = new Date(input.slotEnd!);
      if (!isValidSlot(q.readyAt, slotStart, slotEnd)) throw new DomainError("VALIDATION", "Ce créneau n'est plus disponible.");
    } else {
      invariant(q.slots.length > 0, "Aucun créneau disponible.");
      slotStart = q.slots[0].start;
      slotEnd = q.slots[0].end;
    }

    // Adresse nouvelle
    let addressId = q.destination.address?.id ?? null;
    if (input.fulfillmentMode === "HOME_DELIVERY" && !addressId && input.newAddress) {
      const a = await tx.address.create({ data: { userId, ...input.newAddress } });
      addressId = a.id;
    }

    const cartItems = await tx.cartItem.findMany({
      where: { cart: { userId } },
      include: { portion: true, groupBuy: { select: { productId: true } }, variant: true },
    });
    const lineById = new Map(q.cart.lines.map((l) => [l.id, l]));

    const created = await tx.order.create({
      data: {
        number: await uniqueOrderNumber(tx, now),
        createdAt: now,
        userId,
        status: "PENDING_PAYMENT",
        fulfillmentMode: input.fulfillmentMode,
        pickupPointId: q.destination.mode === "PICKUP" ? q.destination.point.id : null,
        addressId,
        deliveryZoneId: q.destination.mode === "HOME_DELIVERY" ? q.destination.zone.id : null,
        communityId: q.community?.id ?? null,
        deliverySpeed: input.fulfillmentMode === "HOME_DELIVERY" ? input.deliverySpeed : "STANDARD",
        slotStart,
        slotEnd,
        subtotal: q.totals.subtotal,
        referenceTotal: q.totals.referenceTotal,
        savingsTotal: q.totals.savings,
        fractionationFees: q.totals.fractionationFees,
        deliveryFee: q.totals.deliveryFee,
        discountTotal: q.totals.discount,
        creditApplied: q.totals.creditApplied,
        total: q.totals.total,
        promotionId: q.promotion?.id ?? null,
        pickupCode: numericCode(6),
        creditConsent: input.creditConsent,
        expectedReadyAt: q.readyAt,
        idempotencyKey: idempotencyKey ? `${userId}:${idempotencyKey}` : null,
        events: { create: { status: "PENDING_PAYMENT", note: "Commande créée", actorId: userId, createdAt: now } },
        items: {
          create: cartItems.map((ci) => {
            const l = lineById.get(ci.id)!;
            const p = l.price!;
            return {
              kind: ci.kind,
              productId: ci.kind === "GROUP_BUY" ? ci.groupBuy!.productId : ci.variant!.productId,
              groupBuyId: ci.groupBuyId,
              portionId: ci.portionId,
              variantId: ci.variantId,
              label: `${l.label} — ${ci.kind === "GROUP_BUY" ? ci.portion!.label : ci.variant!.name}`,
              quantity: ci.quantity,
              unitQuantityBase: ci.kind === "GROUP_BUY" ? ci.portion!.quantityBase : ci.variant!.quantityBase,
              unitPrice: p.unitPrice,
              referenceUnitPrice: p.referenceUnitPrice,
              referenceObservedAt: p.referenceObservedAt,
              fractionationFee: p.fractionationFee,
              lineTotal: (p.unitPrice + p.fractionationFee) * ci.quantity,
              status: "PENDING_PAYMENT" as const,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Réservations : achats groupés (heldBase) et stock (reservedBase)
    const warehouse = await defaultWarehouse(tx);
    for (const item of created.items) {
      const qty = item.unitQuantityBase * item.quantity;
      if (item.kind === "GROUP_BUY") {
        await tx.groupBuyParticipant.create({
          data: {
            groupBuyId: item.groupBuyId!,
            userId,
            orderItemId: item.id,
            communityId: q.community?.id ?? null,
            quantityBase: qty,
            creditConsent: input.creditConsent,
          },
        });
        await tx.groupBuy.update({ where: { id: item.groupBuyId! }, data: { heldBase: { increment: qty } } });
      } else {
        const inv = await tx.inventory.findFirst({ where: { productId: item.productId }, orderBy: { quantityBase: "desc" } });
        if (!inv || inv.quantityBase - inv.reservedBase < qty) throw new DomainError("CAPACITY_EXCEEDED", `Stock insuffisant pour ${item.label}.`);
        await tx.inventory.update({ where: { id: inv.id }, data: { reservedBase: { increment: qty } } });
        await tx.inventoryMovement.create({
          data: { warehouseId: inv.warehouseId ?? warehouse.id, productId: item.productId, type: "STOCK_SALE_RESERVE", quantityBase: qty, reference: created.number },
        });
      }
    }

    if (q.totals.creditApplied > 0) {
      await tx.creditLedgerEntry.create({
        data: { userId, amount: -q.totals.creditApplied, reason: "ORDER_PAYMENT", orderId: created.id, note: `Utilisé sur ${created.number}` },
      });
    }
    if (q.promotion) await tx.promotion.update({ where: { id: q.promotion.id }, data: { usedCount: { increment: 1 } } });

    await clearCart(userId, tx);

    if (created.total === 0) await markOrderPaid(tx, created.id, null, now);
    return created;
  });

  return order;
}

// ─── Paiement confirmé ───────────────────────────────────────

/**
 * Applique un paiement réussi. Retourne les lignes à rembourser (ex. achat
 * groupé clôturé entre-temps). Idempotent : sans effet si déjà payée.
 */
export async function markOrderPaid(tx: Prisma.TransactionClient, orderId: string, paymentId: string | null, now = new Date()) {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { participant: true } } } });
  if (order.status !== "PENDING_PAYMENT") return { alreadyProcessed: true as const, refundItemIds: [] as string[] };

  const refundItemIds: string[] = [];
  const crossed: Array<{ gbId: string; title: string }> = [];

  for (const item of order.items) {
    if (item.kind === "GROUP_BUY" && item.participant) {
      await tx.$queryRaw`SELECT id FROM "GroupBuy" WHERE id = ${item.groupBuyId!} FOR UPDATE`;
      const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: item.groupBuyId! }, include: { tiers: true } });
      const qty = item.participant.quantityBase;
      if (gb.status === "OPEN") {
        const before = computeProgress(toGroupBuyState(gb)).percentOfTarget;
        const updated = await tx.groupBuy.update({
          where: { id: gb.id },
          data: { heldBase: { decrement: Math.min(qty, gb.heldBase) }, committedBase: { increment: qty }, participantCount: { increment: 1 } },
          include: { tiers: true },
        });
        const after = computeProgress(toGroupBuyState(updated)).percentOfTarget;
        if (before < 90 && after >= 90) crossed.push({ gbId: gb.id, title: gb.title });
        await tx.groupBuyParticipant.update({ where: { id: item.participant.id }, data: { status: "CONFIRMED" } });
        await tx.orderItem.update({ where: { id: item.id }, data: { status: "GROUP_PENDING" } });
        await track("group_buy_joined", order.userId, { groupBuyId: gb.id, quantityBase: qty }, tx);
      } else {
        // Achat clôturé pendant le paiement : la ligne est annulée et remboursée.
        await tx.groupBuyParticipant.update({ where: { id: item.participant.id }, data: { status: "CANCELLED" } });
        await tx.orderItem.update({ where: { id: item.id }, data: { status: "CANCELLED" } });
        refundItemIds.push(item.id);
      }
    } else if (item.kind === "STOCK") {
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "RECEIVED_WAREHOUSE" } });
    }
  }

  await tx.order.update({ where: { id: orderId }, data: { paidAt: now } });
  await tx.orderStatusEvent.create({ data: { orderId, status: "PAID", note: paymentId ? `Paiement ${paymentId}` : "Réglée par avoir" } });
  await recomputeOrderStatus(tx, orderId, null, null);

  // Fiche de livraison (frais figés au moment de la commande)
  const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true, deliveryZone: true } });
  const weightGrams = fresh.items.reduce((s, i) => s + i.unitQuantityBase * i.quantity, 0);
  await tx.delivery.upsert({
    where: { orderId },
    create: {
      orderId,
      mode: fresh.fulfillmentMode,
      pickupPointId: fresh.pickupPointId,
      zoneId: fresh.deliveryZoneId,
      fee: fresh.deliveryFee,
      driverFee: fresh.fulfillmentMode === "HOME_DELIVERY" ? computeDriverFee(fresh.deliveryZone?.distanceKm ?? 5, weightGrams) : 0,
      weightGrams,
      scheduledStart: fresh.slotStart,
      scheduledEnd: fresh.slotEnd,
    },
    update: {},
  });

  await notify(order.userId, "payment_confirmed", { number: order.number, amount: order.total, savings: order.savingsTotal }, { channels: ["SMS"] }, tx);
  await track("payment_completed", order.userId, { orderId, total: order.total, savings: order.savingsTotal }, tx);
  const previousPaid = await tx.order.count({ where: { userId: order.userId, paidAt: { not: null }, id: { not: orderId } } });
  if (previousPaid > 0) await track("repeat_purchase", order.userId, { orderId }, tx);

  for (const c of crossed) await notifyGroupProgress(tx, c.gbId);
  return { alreadyProcessed: false as const, refundItemIds };
}

/** « Votre achat groupé est à 92 % » : envoyé une fois, au franchissement de 90 %. */
async function notifyGroupProgress(tx: Prisma.TransactionClient, gbId: string) {
  const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: gbId }, include: { tiers: true } });
  const p = computeProgress(toGroupBuyState(gb));
  const users = await tx.groupBuyParticipant.findMany({ where: { groupBuyId: gbId, status: "CONFIRMED" }, select: { userId: true }, distinct: ["userId"] });
  const remaining = p.remainingToNextTierUnits ?? p.remainingToTargetUnits;
  const { title, body } = {
    title: "Achat groupé presque complet",
    body: `« ${gb.title} » est à ${Math.floor(p.percentOfTarget)} %. Encore ${formatUnits(remaining, 0)} ${gb.supplierUnitLabel.toLowerCase()} pour débloquer le prochain prix.`,
  };
  await tx.notification.createMany({
    data: users.map((u) => ({ userId: u.userId, channel: "IN_APP" as const, template: "group_progress", title, body, status: "SENT" as const, sentAt: new Date() })),
  });
}

// ─── Statuts ─────────────────────────────────────────────────

const DELIVERY_DRIVEN: OrderStatus[] = ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "DELIVERED"];

export async function recomputeOrderStatus(tx: Db, orderId: string, note: string | null, actorId: string | null) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { select: { status: true } } } });
  let next = deriveOrderStatus(order.items.map((i) => i.status));
  if (next === "READY" && DELIVERY_DRIVEN.includes(order.status)) next = order.status;
  if (next !== order.status) {
    await tx.order.update({
      where: { id: orderId },
      data: { status: next, ...(next === "CANCELLED" ? { cancelledAt: new Date() } : {}), ...(next === "DELIVERED" ? { deliveredAt: new Date() } : {}) },
    });
    await tx.orderStatusEvent.create({ data: { orderId, status: next, note, actorId } });
  }
  return next;
}

/** Fait avancer les lignes d'un achat groupé (participants confirmés) puis recalcule les commandes. */
export async function advanceGroupItems(
  tx: Db,
  groupBuyId: string,
  from: OrderStatus[],
  to: OrderStatus,
  note: string,
  actorId: string | null,
) {
  const items = await tx.orderItem.findMany({
    where: { groupBuyId, status: { in: from }, participant: { status: "CONFIRMED" } },
    select: { id: true, orderId: true },
  });
  if (!items.length) return 0;
  await tx.orderItem.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { status: to } });
  for (const orderId of new Set(items.map((i) => i.orderId))) await recomputeOrderStatus(tx, orderId, note, actorId);
  return items.length;
}

// ─── Annulation & expiration ─────────────────────────────────

async function releaseHolds(tx: Prisma.TransactionClient, orderId: string, paid: boolean) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { participant: true } } } });
  for (const item of order.items) {
    const qty = item.unitQuantityBase * item.quantity;
    if (item.kind === "GROUP_BUY" && item.participant && ["PENDING_PAYMENT", "CONFIRMED"].includes(item.participant.status)) {
      const wasConfirmed = item.participant.status === "CONFIRMED";
      await tx.$queryRaw`SELECT id FROM "GroupBuy" WHERE id = ${item.groupBuyId!} FOR UPDATE`;
      const gb = await tx.groupBuy.findUniqueOrThrow({ where: { id: item.groupBuyId! } });
      await tx.groupBuy.update({
        where: { id: gb.id },
        data: wasConfirmed
          ? { committedBase: { decrement: Math.min(qty, gb.committedBase) }, participantCount: { decrement: gb.participantCount > 0 ? 1 : 0 } }
          : { heldBase: { decrement: Math.min(qty, gb.heldBase) } },
      });
      await tx.groupBuyParticipant.update({ where: { id: item.participant.id }, data: { status: "CANCELLED" } });
    }
    if (item.kind === "STOCK" && !["CANCELLED", "REFUNDED", "DELIVERED"].includes(item.status)) {
      const inv = await tx.inventory.findFirst({ where: { productId: item.productId, reservedBase: { gte: qty } } });
      if (inv) {
        await tx.inventory.update({ where: { id: inv.id }, data: { reservedBase: { decrement: qty } } });
        await tx.inventoryMovement.create({
          data: { warehouseId: inv.warehouseId, productId: item.productId, type: "STOCK_SALE_RELEASE", quantityBase: qty, reference: order.number },
        });
      }
    }
  }
  await tx.orderItem.updateMany({ where: { orderId, status: { notIn: ["CANCELLED", "REFUNDED"] } }, data: { status: paid ? "REFUNDED" : "CANCELLED" } });
  if (order.creditApplied > 0) {
    await tx.creditLedgerEntry.create({
      data: { userId: order.userId, amount: order.creditApplied, reason: "GOODWILL", orderId, note: `Avoir restitué (${order.number})` },
    });
  }
  if (order.promotionId) await tx.promotion.update({ where: { id: order.promotionId }, data: { usedCount: { decrement: 1 } } });
}

const USER_CANCELLABLE: OrderStatus[] = ["PENDING_PAYMENT", "GROUP_PENDING", "RECEIVED_WAREHOUSE"];

/** Annulation par le client : possible tant que les achats groupés ne sont pas clôturés. */
export async function cancelOrder(userId: string, orderId: string, db: Db = prisma) {
  const { requestRefund, processPendingRefunds } = await import("./payment.service");
  const result = await inTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.order.findFirst({ where: { id: orderId, userId }, include: { items: { include: { groupBuy: true } }, delivery: true } });
    if (!order) throw new DomainError("NOT_FOUND", "Commande introuvable.");
    if (!USER_CANCELLABLE.includes(order.status)) throw new DomainError("INVALID_STATE", "Cette commande ne peut plus être annulée.");
    if (order.items.some((i) => i.groupBuy && i.groupBuy.status !== "OPEN")) {
      throw new DomainError("INVALID_STATE", "Un achat groupé de cette commande est déjà clôturé : contactez le support.");
    }
    const paid = order.status !== "PENDING_PAYMENT";
    await releaseHolds(tx, orderId, paid);
    await tx.order.update({ where: { id: orderId }, data: { status: paid ? "REFUNDED" : "CANCELLED", cancelledAt: new Date() } });
    await tx.orderStatusEvent.create({ data: { orderId, status: paid ? "REFUNDED" : "CANCELLED", note: "Annulée par le client", actorId: userId } });
    if (order.delivery) await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: "CANCELLED" } });
    if (paid) {
      const paidAmount = order.total;
      if (paidAmount > 0) await requestRefund(tx, { orderId, amount: paidAmount, reason: "CANCELLATION", note: "Annulation client" });
    }
    return { paid };
  });
  if (result.paid) await processPendingRefunds(db);
  return result;
}

/** Tâche : annule les commandes non payées depuis plus d'une heure (libère les réservations). */
export async function expireUnpaidOrders(db: Db = prisma, now = new Date()) {
  const stale = await db.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: new Date(now.getTime() - 3_600_000) },
      payments: { none: { status: "PENDING", expiresAt: { gt: now } } },
    },
    select: { id: true },
    take: 200,
  });
  for (const o of stale) {
    await inTransaction(db, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${o.id} FOR UPDATE`;
      const current = await tx.order.findUniqueOrThrow({ where: { id: o.id } });
      if (current.status !== "PENDING_PAYMENT") return;
      await releaseHolds(tx, o.id, false);
      await tx.order.update({ where: { id: o.id }, data: { status: "CANCELLED", cancelledAt: now } });
      await tx.orderStatusEvent.create({ data: { orderId: o.id, status: "CANCELLED", note: "Paiement non reçu dans le délai" } });
    });
  }
  return stale.length;
}

// ─── Lecture ─────────────────────────────────────────────────

export async function listOrders(userId: string, db: Db = prisma) {
  return db.order.findMany({
    where: { userId, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    include: { items: { select: { label: true, quantity: true } }, pickupPoint: { select: { name: true } } },
    take: 100,
  });
}

export async function getOrderForUser(userId: string, orderId: string, db: Db = prisma) {
  const order = await db.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { include: { product: { select: { emoji: true, slug: true } }, participant: true, groupBuy: { select: { slug: true, title: true, status: true, closesAt: true, alternativeUnitPrice: true, supplierUnitQuantityBase: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { orderBy: { createdAt: "desc" } },
      delivery: { include: { driver: { include: { user: { select: { firstName: true, phone: true } } } } } },
      events: { orderBy: { createdAt: "asc" } },
      pickupPoint: true,
      address: true,
      reviews: true,
    },
  });
  if (!order) throw new DomainError("NOT_FOUND", "Commande introuvable.");
  return {
    ...order,
    timeline: buildTimeline(order.status, { mode: order.fulfillmentMode, hasGroupItems: order.items.some((i) => i.kind === "GROUP_BUY") }),
    isActive: statusRank(order.status) >= 0 && order.status !== "DELIVERED",
  };
}
