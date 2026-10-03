/**
 * GroupBuyService : cœur de Sesam-Market.
 * Publication (avec contrôle d'économie unitaire), progression, clôture,
 * règlement (paliers / règles d'échec), demande consolidée.
 */
import type { Prisma } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError, invariant } from "@/domain/errors";
import {
  computeProgress,
  describeFailurePolicy,
  estimateOrdersNeeded,
  evaluateDeadline,
  settleFailure,
  settleSuccess,
} from "@/domain/group-buy";
import { normalizeTiers, portionFractionationFee, portionPrice, validatePortions } from "@/domain/pricing";
import { aggregateDemand } from "@/domain/aggregation";
import { planFractionation } from "@/domain/fractionation";
import { assessCampaign, computeUnitEconomics, type CampaignCosts } from "@/domain/unit-economics";
import { referenceFreshness } from "@/domain/reference-price";
import { formatDate } from "@/domain/dates";
import { prorate } from "@/domain/money";
import type { GroupBuyInput } from "./schemas";
import { toGroupBuyState, type GroupBuyWithTiers } from "./pricing.service";
import { advanceGroupItems, recomputeOrderStatus } from "./order.service";
import { processPendingRefunds, requestRefund } from "./payment.service";
import { notify } from "./notification.service";
import { audit } from "./audit.service";
import { track } from "./analytics.service";

const listInclude = {
  tiers: true,
  portions: { orderBy: { quantityBase: "asc" } },
  product: { select: { id: true, name: true, emoji: true, slug: true, baseUnit: true, category: { select: { name: true, slug: true } } } },
  community: { select: { name: true, slug: true } },
} satisfies Prisma.GroupBuyInclude;

function view(gb: Prisma.GroupBuyGetPayload<{ include: typeof listInclude }>, now = new Date()) {
  const progress = computeProgress(toGroupBuyState(gb));
  const fresh = referenceFreshness(gb.referenceObservedAt, now) === "fresh";
  return {
    ...gb,
    progress,
    referenceIsFresh: fresh,
    /** Économie par unité fournisseur au prix objectif (null si référence périmée) */
    targetSavingPerUnit: fresh ? Math.max(0, gb.referenceUnitPrice - progress.targetUnitPrice) : null,
    currentSavingPerUnit: fresh ? Math.max(0, gb.referenceUnitPrice - progress.payableUnitPrice) : null,
  };
}

export type GroupBuyView = ReturnType<typeof view>;

export async function listOpenGroupBuys(params: { take?: number; categorySlug?: string } = {}, db: Db = prisma, now = new Date()) {
  const gbs = await db.groupBuy.findMany({
    where: { status: "OPEN", closesAt: { gt: now }, ...(params.categorySlug ? { product: { category: { slug: params.categorySlug } } } : {}) },
    include: listInclude,
    orderBy: { closesAt: "asc" },
    take: params.take ?? 50,
  });
  return gbs.map((g) => view(g, now));
}

export async function getGroupBuyDetail(slug: string, userId: string | null, db: Db = prisma, now = new Date()) {
  const gb = await db.groupBuy.findUnique({ where: { slug }, include: listInclude });
  if (!gb || gb.status === "DRAFT") throw new DomainError("NOT_FOUND", "Achat groupé introuvable.");
  const v = view(gb, now);
  const avgParticipantBase = gb.participantCount > 0 ? gb.committedBase / gb.participantCount : gb.expectedAvgPortionBase;
  const portions = gb.portions.map((p) => {
    const unitPrice = portionPrice(v.progress.payableUnitPrice, p.quantityBase, gb.supplierUnitQuantityBase);
    const fee = portionFractionationFee(p.quantityBase, gb.supplierUnitQuantityBase, gb.fractionationFeePerPortion);
    const reference = v.referenceIsFresh ? prorate(gb.referenceUnitPrice, p.quantityBase, gb.supplierUnitQuantityBase) : null;
    return {
      ...p,
      unitPrice,
      fractionationFee: fee,
      targetPrice: portionPrice(v.progress.targetUnitPrice, p.quantityBase, gb.supplierUnitQuantityBase),
      reference,
      saving: reference !== null ? Math.max(0, reference - unitPrice - fee) : null,
    };
  });
  const remainingNextBase = (v.progress.remainingToNextTierUnits ?? 0) * gb.supplierUnitQuantityBase;
  const myParticipation = userId
    ? await db.groupBuyParticipant.aggregate({ where: { groupBuyId: gb.id, userId, status: "CONFIRMED" }, _sum: { quantityBase: true } })
    : null;
  if (userId) await track("group_buy_viewed", userId, { groupBuyId: gb.id }, db);
  return {
    ...v,
    portions,
    failurePolicyText: describeFailurePolicy(gb.failurePolicy, { extensionDays: gb.extensionDays, maxExtensions: gb.maxExtensions }),
    estimatedOrdersToNextTier: estimateOrdersNeeded(remainingNextBase, avgParticipantBase),
    myQuantityBase: myParticipation?._sum.quantityBase ?? 0,
  };
}

// ─── Administration ──────────────────────────────────────────

function costsOf(gb: CampaignCosts): CampaignCosts {
  return {
    supplierUnitQuantityBase: gb.supplierUnitQuantityBase,
    supplierUnitCost: gb.supplierUnitCost,
    inboundTransportPerUnit: gb.inboundTransportPerUnit,
    storagePerUnit: gb.storagePerUnit,
    fractionationFeePerPortion: gb.fractionationFeePerPortion,
    fractionationCostPerPortion: gb.fractionationCostPerPortion,
    packagingCostPerPortion: gb.packagingCostPerPortion,
    lossRateBps: gb.lossRateBps,
    paymentFeeBps: gb.paymentFeeBps,
    deliveryCostPerOrder: gb.deliveryCostPerOrder,
    promotionCostPerUnit: gb.promotionCostPerUnit,
    expectedAvgPortionBase: gb.expectedAvgPortionBase,
  };
}

function validateInput(input: GroupBuyInput) {
  normalizeTiers(input.tiers);
  validatePortions(input.portions.map((p) => p.quantityBase), input.supplierUnitQuantityBase);
  invariant(input.closesAt > input.opensAt, "La date limite doit suivre l'ouverture.");
  invariant(input.expectedDeliveryAt > input.closesAt, "La livraison prévue doit suivre la date limite.");
  invariant(input.maxUnits >= input.targetUnits, "La capacité doit être au moins égale à l'objectif.");
  invariant(input.targetUnits >= Math.min(...input.tiers.map((t) => t.minUnits)), "L'objectif doit atteindre au moins le premier palier.");
  if (input.failurePolicy === "ALTERNATIVE_PRICE") {
    invariant(!!input.alternativeUnitPrice, "Indiquez le prix alternatif proposé en cas d'échec.");
  }
}

export async function createGroupBuy(input: GroupBuyInput, actorId: string, db: Db = prisma) {
  validateInput(input);
  const { tiers, portions, ...data } = input;
  const base = `${input.title}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  let slug = base;
  for (let i = 2; await db.groupBuy.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  const gb = await db.groupBuy.create({
    data: {
      ...data,
      supplierProductId: data.supplierProductId || null,
      communityId: data.communityId || null,
      slug,
      status: "DRAFT",
      tiers: { create: tiers },
      portions: { create: portions.map((p, i) => ({ ...p, sortOrder: i })) },
    },
  });
  await audit({ actorId, action: "groupbuy.create", entityType: "GroupBuy", entityId: gb.id, after: { ...input, tiers, portions } }, db);
  return gb;
}

export async function assessGroupBuy(id: string, db: Db = prisma, now = new Date()) {
  const gb = await db.groupBuy.findUniqueOrThrow({ where: { id }, include: { tiers: true } });
  return assessCampaign(costsOf(gb), gb.tiers, gb.referenceUnitPrice, referenceFreshness(gb.referenceObservedAt, now) === "fresh");
}

/**
 * Publication : bloquée si le prix de référence est périmé ; si la campagne
 * est structurellement déficitaire, un acquittement explicite et motivé est
 * exigé (et journalisé).
 */
export async function publishGroupBuy(
  id: string,
  actorId: string,
  opts: { acknowledgeDeficit?: boolean; reason?: string } = {},
  db: Db = prisma,
  now = new Date(),
) {
  const gb = await db.groupBuy.findUniqueOrThrow({ where: { id } });
  if (gb.status !== "DRAFT") throw new DomainError("INVALID_STATE", "Seul un brouillon peut être publié.");
  const assessment = await assessGroupBuy(id, db, now);
  if (assessment.warnings.some((w) => w.code === "STALE_REFERENCE")) {
    throw new DomainError("INVALID_STATE", "Prix de référence périmé : faites un nouveau relevé avant de publier.");
  }
  if (assessment.requiresAcknowledgement) {
    if (!opts.acknowledgeDeficit || !opts.reason || opts.reason.trim().length < 15) {
      throw new DomainError("VALIDATION", "Campagne déficitaire : cochez l'acquittement et justifiez (15 caractères minimum).", {
        warnings: assessment.warnings,
      });
    }
  }
  const updated = await db.groupBuy.update({
    where: { id },
    data: {
      status: "OPEN",
      publishedAt: now,
      publishedById: actorId,
      deficitAcknowledged: assessment.requiresAcknowledgement,
      deficitReason: assessment.requiresAcknowledgement ? opts.reason : null,
    },
  });
  await audit(
    { actorId, action: "groupbuy.publish", entityType: "GroupBuy", entityId: id, after: { warnings: assessment.warnings, reason: opts.reason ?? null } },
    db,
  );
  return updated;
}

/** Journalise toute modification de prix (paliers) — autorisée uniquement en brouillon. */
export async function updateTiers(id: string, tiers: Array<{ minUnits: number; unitPrice: number }>, actorId: string, db: Db = prisma) {
  const gb = await db.groupBuy.findUniqueOrThrow({ where: { id }, include: { tiers: true } });
  if (gb.status !== "DRAFT") throw new DomainError("INVALID_STATE", "Les paliers d'un achat publié ne peuvent plus être modifiés.");
  normalizeTiers(tiers);
  await inTransaction(db, async (tx) => {
    await tx.groupBuyTier.deleteMany({ where: { groupBuyId: id } });
    await tx.groupBuyTier.createMany({ data: tiers.map((t) => ({ ...t, groupBuyId: id })) });
    await audit({ actorId, action: "price.tiers.update", entityType: "GroupBuy", entityId: id, before: gb.tiers, after: tiers }, tx);
  });
}

// ─── Clôture & règlement ─────────────────────────────────────

/**
 * Clôture d'un achat groupé.
 * - `force: "success"` : clôture anticipée par un admin (seuil atteint requis) ;
 * - sinon : décision à l'échéance (succès, prolongation ou échec selon la règle).
 */
export async function closeGroupBuy(
  id: string,
  actorId: string | null,
  opts: { force?: "success" | "cancel" } = {},
  db: Db = prisma,
  now = new Date(),
) {
  const outcome = await inTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "GroupBuy" WHERE id = ${id} FOR UPDATE`;
    const gb = (await tx.groupBuy.findUniqueOrThrow({ where: { id }, include: { tiers: true } })) as GroupBuyWithTiers;
    if (gb.status !== "OPEN") throw new DomainError("INVALID_STATE", "Cet achat groupé n'est pas ouvert.");
    const state = toGroupBuyState(gb);

    let decision = evaluateDeadline(state, now);
    if (opts.force === "success") {
      if (!computeProgress(state).minimumReached) throw new DomainError("INVALID_STATE", "Le seuil minimal n'est pas atteint.");
      decision = { action: "CLOSE_SUCCESS" };
    } else if (opts.force === "cancel") {
      decision = { action: "CLOSE_FAILED", policy: "REFUND" };
    }
    if (decision.action === "NONE") return { action: "NONE" as const };

    // Les réservations non payées sont abandonnées à la clôture.
    if (decision.action !== "EXTEND") {
      const unpaid = await tx.groupBuyParticipant.findMany({ where: { groupBuyId: id, status: "PENDING_PAYMENT" } });
      for (const p of unpaid) {
        await tx.groupBuyParticipant.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
        await tx.orderItem.update({ where: { id: p.orderItemId }, data: { status: "CANCELLED" } });
      }
      await tx.groupBuy.update({ where: { id }, data: { heldBase: 0 } });
    }

    if (decision.action === "EXTEND") {
      await tx.groupBuy.update({
        where: { id },
        data: {
          closesAt: decision.newClosesAt,
          extensionsUsed: { increment: 1 },
          expectedDeliveryAt: new Date(gb.expectedDeliveryAt.getTime() + (decision.newClosesAt.getTime() - gb.closesAt.getTime())),
        },
      });
      const users = await tx.groupBuyParticipant.findMany({ where: { groupBuyId: id, status: "CONFIRMED" }, select: { userId: true }, distinct: ["userId"] });
      for (const u of users) await notify(u.userId, "group_extended", { title: gb.title, date: formatDate(decision.newClosesAt) }, {}, tx);
      await audit({ actorId, action: "groupbuy.extend", entityType: "GroupBuy", entityId: id, after: { closesAt: decision.newClosesAt } }, tx);
      return { action: "EXTEND" as const };
    }

    const participants = await tx.groupBuyParticipant.findMany({
      where: { groupBuyId: id, status: "CONFIRMED" },
      include: { orderItem: true },
    });
    const settlementInput = participants.map((p) => ({
      orderItemId: p.orderItemId,
      quantity: p.orderItem.quantity,
      portionBase: p.orderItem.unitQuantityBase,
      paidPortionPrice: p.orderItem.unitPrice,
      creditConsent: p.creditConsent,
      paidFractionationFee: p.orderItem.fractionationFee,
    }));
    const userOf = new Map(participants.map((p) => [p.orderItemId, p]));

    if (decision.action === "CLOSE_SUCCESS") {
      const s = settleSuccess(gb.tiers, gb.committedBase, gb.supplierUnitQuantityBase, settlementInput);
      await tx.groupBuy.update({ where: { id }, data: { status: "CLOSED_SUCCESS", finalUnitPrice: s.finalUnitPrice, closedAt: now } });
      const refundByUser = new Map<string, number>();
      for (const line of s.lines) {
        const p = userOf.get(line.orderItemId)!;
        await tx.orderItem.update({ where: { id: line.orderItemId }, data: { finalUnitPrice: line.finalPortionPrice, status: "GROUP_CONFIRMED" } });
        if (line.refundAmount > 0) {
          await requestRefund(tx, {
            orderId: p.orderItem.orderId,
            orderItemId: line.orderItemId,
            amount: line.refundAmount,
            reason: "TIER_PRICE_DIFFERENCE",
            note: "Palier plus avantageux atteint",
          });
        }
        refundByUser.set(p.userId, (refundByUser.get(p.userId) ?? 0) + line.refundAmount);
      }
      // Économies recalculées au prix final
      for (const orderId of new Set(participants.map((p) => p.orderItem.orderId))) {
        await refreshOrderSavings(tx, orderId);
        await recomputeOrderStatus(tx, orderId, `Achat groupé « ${gb.title} » confirmé`, actorId);
      }
      for (const [userId, refund] of refundByUser) {
        await notify(
          userId,
          "group_confirmed",
          { title: gb.title, unitPrice: s.finalUnitPrice, unitLabel: `le ${gb.supplierUnitLabel.toLowerCase()}`, refund },
          { channels: ["SMS"] },
          tx,
        );
      }
      await audit({ actorId, action: "groupbuy.close.success", entityType: "GroupBuy", entityId: id, after: { finalUnitPrice: s.finalUnitPrice, totalRefund: s.totalRefund } }, tx);
      return { action: "CLOSE_SUCCESS" as const, finalUnitPrice: s.finalUnitPrice, totalRefund: s.totalRefund };
    }

    // Échec
    const lines = settleFailure(decision.policy, settlementInput);
    await tx.groupBuy.update({ where: { id }, data: { status: opts.force === "cancel" ? "CANCELLED" : "CLOSED_FAILED", closedAt: now } });
    for (const line of lines) {
      const p = userOf.get(line.orderItemId)!;
      if (line.action === "REFUND") {
        await tx.groupBuyParticipant.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
        await tx.orderItem.update({ where: { id: line.orderItemId }, data: { status: "REFUNDED" } });
        await requestRefund(tx, { orderId: p.orderItem.orderId, orderItemId: line.orderItemId, amount: line.amount, reason: "GROUP_FAILED" });
        await notify(p.userId, "group_failed_refund", { title: gb.title, amount: line.amount }, { channels: ["SMS"] }, tx);
      } else if (line.action === "CREDIT") {
        await tx.groupBuyParticipant.update({ where: { id: p.id }, data: { status: "CREDITED" } });
        await tx.orderItem.update({ where: { id: line.orderItemId }, data: { status: "REFUNDED", refundedAmount: line.amount } });
        await tx.creditLedgerEntry.create({
          data: { userId: p.userId, amount: line.amount, reason: "GROUP_FAILED_CONVERSION", orderId: p.orderItem.orderId, note: `Avoir accepté — ${gb.title}` },
        });
        await notify(p.userId, "group_failed_credit", { title: gb.title, amount: line.amount }, {}, tx);
      } else {
        await tx.groupBuyParticipant.update({ where: { id: p.id }, data: { status: "AWAITING_DECISION" } });
        await notify(p.userId, "group_alternative", { title: gb.title }, { channels: ["SMS"] }, tx);
      }
    }
    for (const orderId of new Set(participants.map((p) => p.orderItem.orderId))) {
      await settleOrderAfterItemLoss(tx, orderId);
      await recomputeOrderStatus(tx, orderId, `Achat groupé « ${gb.title} » non abouti`, actorId);
    }
    await audit({ actorId, action: "groupbuy.close.failed", entityType: "GroupBuy", entityId: id, after: { policy: decision.policy } }, tx);
    return { action: "CLOSE_FAILED" as const, policy: decision.policy };
  });

  await processPendingRefunds(db);
  return outcome;
}

async function refreshOrderSavings(tx: Prisma.TransactionClient, orderId: string) {
  const { orderSavings } = await import("@/domain/savings");
  const items = await tx.orderItem.findMany({ where: { orderId, status: { notIn: ["CANCELLED", "REFUNDED"] } } });
  await tx.order.update({ where: { id: orderId }, data: { savingsTotal: orderSavings(items) } });
}

/**
 * Si plus aucune ligne n'est active, les frais de livraison payés sont aussi
 * remboursés (rien ne sera livré). La fiche de livraison est annulée.
 */
async function settleOrderAfterItemLoss(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { include: { participant: true } }, delivery: true } });
  await refreshOrderSavings(tx, orderId);
  const stillActive = order.items.some(
    (i) => !["CANCELLED", "REFUNDED"].includes(i.status) || i.participant?.status === "AWAITING_DECISION",
  );
  if (stillActive) return;
  if (order.deliveryFee > 0) {
    await requestRefund(tx, { orderId, amount: order.deliveryFee, reason: "GROUP_FAILED", note: "Frais de livraison remboursés" });
  }
  if (order.delivery) await tx.delivery.update({ where: { id: order.delivery.id }, data: { status: "CANCELLED" } });
}

/** Réponse d'un participant à la proposition de prix alternatif. */
export async function declineAlternative(userId: string, orderItemId: string, db: Db = prisma) {
  await inTransaction(db, async (tx) => {
    const p = await tx.groupBuyParticipant.findFirst({ where: { orderItemId, userId, status: "AWAITING_DECISION" }, include: { orderItem: true } });
    if (!p) throw new DomainError("NOT_FOUND", "Aucune proposition en attente.");
    await tx.groupBuyParticipant.update({ where: { id: p.id }, data: { status: "REFUNDED" } });
    await tx.orderItem.update({ where: { id: orderItemId }, data: { status: "REFUNDED" } });
    await requestRefund(tx, {
      orderId: p.orderItem.orderId,
      orderItemId,
      amount: (p.orderItem.unitPrice + p.orderItem.fractionationFee) * p.orderItem.quantity,
      reason: "GROUP_FAILED",
      note: "Prix alternatif refusé",
    });
    await settleOrderAfterItemLoss(tx, p.orderItem.orderId);
    await recomputeOrderStatus(tx, p.orderItem.orderId, "Prix alternatif refusé", userId);
  });
  await processPendingRefunds(db);
}

/** Sans réponse 72 h après la clôture : remboursement (jamais de débit sans accord). */
export async function expireAlternativeDecisions(db: Db = prisma, now = new Date()) {
  const stale = await db.groupBuyParticipant.findMany({
    where: { status: "AWAITING_DECISION", groupBuy: { closedAt: { lt: new Date(now.getTime() - 72 * 3_600_000) } } },
    select: { userId: true, orderItemId: true },
  });
  for (const s of stale) await declineAlternative(s.userId, s.orderItemId, db);
  return stale.length;
}

/** Tâche planifiée : traite toutes les échéances dépassées. */
export async function runDeadlines(db: Db = prisma, now = new Date()) {
  const due = await db.groupBuy.findMany({ where: { status: "OPEN", closesAt: { lte: now } }, select: { id: true } });
  const results = [];
  for (const g of due) results.push({ id: g.id, ...(await closeGroupBuy(g.id, null, {}, db, now)) });
  return results;
}

// ─── Demande consolidée & économie réelle ────────────────────

export async function consolidatedDemand(id: string, db: Db = prisma) {
  const gb = await db.groupBuy.findUniqueOrThrow({ where: { id }, include: { tiers: true, product: true, portions: true } });
  const items = await db.orderItem.groupBy({
    by: ["unitQuantityBase"],
    where: { groupBuyId: id, participant: { status: "CONFIRMED" } },
    _sum: { quantity: true },
    _count: { orderId: true },
  });
  const lines = items.map((i) => ({ portionBase: i.unitQuantityBase, quantity: i._sum.quantity ?? 0 }));
  const demand = aggregateDemand(lines, gb.supplierUnitQuantityBase, gb.lossRateBps);
  const plan = planFractionation(lines, gb.supplierUnitQuantityBase, gb.lossRateBps);
  const orders = await db.orderItem.findMany({
    where: { groupBuyId: id, participant: { status: "CONFIRMED" } },
    select: { orderId: true },
    distinct: ["orderId"],
  });
  const price = gb.finalUnitPrice ?? computeProgress(toGroupBuyState(gb)).payableUnitPrice;
  const economics = computeUnitEconomics({
    ...costsOf(gb),
    units: demand.exactSupplierUnits,
    customerUnitPrice: price,
    portions: demand.totalPortions,
    repackedPortions: demand.portionsToRepack,
    orders: orders.length,
  });
  return { groupBuy: gb, demand, plan, economics, ordersCount: orders.length };
}

export { advanceGroupItems };
