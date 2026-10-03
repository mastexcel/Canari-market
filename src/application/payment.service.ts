/**
 * PaymentService : initiation, webhooks sécurisés et idempotents,
 * prévention des doubles paiements, remboursements.
 */
import { Prisma, type RefundReason } from "@prisma/client";
import { z } from "zod";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { randomToken } from "@/infrastructure/crypto";
import { env } from "@/infrastructure/env";
import { logger } from "@/infrastructure/logger";
import { getPaymentProvider } from "@/infrastructure/payments/registry";
import { WebhookVerificationError } from "@/infrastructure/payments/provider";
import { DomainError } from "@/domain/errors";
import { decidePaymentEvent, maskPhone, refundableAmount, statusAfterRefund, type PaymentStatus } from "@/domain/payment";
import { alternativePriceSupplement } from "@/domain/group-buy";
import { normalizeIvorianPhone } from "@/domain/phone";
import type { paymentInitSchema } from "./schemas";
import { markOrderPaid, recomputeOrderStatus } from "./order.service";
import { notify } from "./notification.service";

const PAYMENT_TTL_MS = 30 * 60 * 1000;

async function supplementAmount(db: Db, orderId: string, orderItemId: string | undefined) {
  if (!orderItemId) throw new DomainError("VALIDATION", "Ligne concernée manquante.");
  const item = await db.orderItem.findFirst({
    where: { id: orderItemId, orderId },
    include: { participant: true, groupBuy: true },
  });
  if (!item?.participant || item.participant.status !== "AWAITING_DECISION" || !item.groupBuy?.alternativeUnitPrice) {
    throw new DomainError("INVALID_STATE", "Aucune proposition de prix en attente pour cette ligne.");
  }
  return alternativePriceSupplement(item.groupBuy.alternativeUnitPrice, item.unitQuantityBase, item.groupBuy.supplierUnitQuantityBase, item.unitPrice, item.quantity);
}

export async function initiatePayment(
  userId: string,
  input: z.infer<typeof paymentInitSchema>,
  idempotencyKey: string | null,
  db: Db = prisma,
  now = new Date(),
) {
  const order = await db.order.findFirst({ where: { id: input.orderId, userId } });
  if (!order) throw new DomainError("NOT_FOUND", "Commande introuvable.");

  let amount: number;
  if (input.purpose === "ORDER") {
    if (order.status !== "PENDING_PAYMENT") throw new DomainError("CONFLICT", "Cette commande est déjà réglée ou n'est plus payable.");
    amount = order.total;
  } else {
    amount = await supplementAmount(db, order.id, input.orderItemId);
  }
  if (amount <= 0) throw new DomainError("INVALID_STATE", "Aucun montant à payer.");
  if (input.method === "MOBILE_MONEY" && (!input.operator || !input.payerPhone)) {
    throw new DomainError("VALIDATION", "Choisissez l'opérateur et le numéro Mobile Money.");
  }
  const payerPhone = input.payerPhone ? normalizeIvorianPhone(input.payerPhone) : null;

  const key = idempotencyKey ? `${userId}:${idempotencyKey}` : null;
  if (key) {
    const byKey = await db.payment.findUnique({ where: { idempotencyKey: key } });
    if (byKey) {
      if (byKey.orderId !== order.id) throw new DomainError("CONFLICT", "Clé d'idempotence déjà utilisée.");
      return { paymentId: byKey.id, redirectUrl: `/paiement/${byKey.id}`, reused: true };
    }
  }
  // Un seul paiement en cours par commande et par objet : pas de double débit.
  const pending = await db.payment.findFirst({
    where: { orderId: order.id, purpose: input.purpose, orderItemId: input.orderItemId ?? null, status: { in: ["PENDING", "AUTHORIZED"] }, expiresAt: { gt: now } },
  });
  if (pending) return { paymentId: pending.id, redirectUrl: `/paiement/${pending.id}`, reused: true };

  const provider = getPaymentProvider();
  const payment = await db.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      purpose: input.purpose,
      orderItemId: input.orderItemId ?? null,
      method: input.method,
      operator: input.method === "MOBILE_MONEY" ? input.operator : null,
      amount,
      idempotencyKey: key ?? `auto:${randomToken(16)}`,
      payerPhoneMasked: payerPhone ? maskPhone(payerPhone) : null,
      expiresAt: new Date(now.getTime() + PAYMENT_TTL_MS),
    },
  });
  const charge = await provider.createCharge({
    paymentId: payment.id,
    amount,
    currency: "XOF",
    method: input.method,
    operator: input.operator ?? null,
    payerPhone,
    description: `CANARI ${order.number}`,
    returnUrl: `${env().APP_URL}/commandes/${order.id}`,
    notifyUrl: `${env().APP_URL}/api/v1/webhooks/payments/${provider.name}`,
  });
  await db.payment.update({ where: { id: payment.id }, data: { providerRef: charge.providerRef } });
  await db.paymentTransaction.create({
    data: { paymentId: payment.id, type: "CHARGE", provider: provider.name, providerEventId: `charge_${payment.id}`, amount, status: "PENDING", payload: { providerRef: charge.providerRef } },
  });
  return { paymentId: payment.id, redirectUrl: charge.redirectUrl, reused: false };
}

export type WebhookResult = { status: "applied" | "duplicate" | "ignored"; paymentId?: string };

/**
 * Traite un webhook prestataire : signature vérifiée, déduplication par
 * (prestataire, identifiant d'événement), transition contrôlée, verrou sur le paiement.
 */
export async function handlePaymentWebhook(providerName: string, rawBody: string, headers: Headers, db: Db = prisma): Promise<WebhookResult> {
  const provider = getPaymentProvider(providerName);
  let event;
  try {
    event = await provider.parseWebhook(rawBody, headers);
  } catch (e) {
    if (e instanceof WebhookVerificationError || e instanceof z.ZodError) {
      logger.warn("webhook.rejected", { provider: providerName, reason: e.message });
      throw new DomainError("UNAUTHENTICATED", "Webhook refusé.");
    }
    throw e;
  }

  const result = await inTransaction(db, async (tx): Promise<WebhookResult> => {
    const payment = await tx.payment.findUnique({ where: { providerRef: event.providerRef } });
    if (!payment) {
      logger.warn("webhook.unknown_payment", { provider: providerName, ref: event.providerRef });
      return { status: "ignored" };
    }
    await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    // Déduplication : le verrou sur le paiement sérialise les livraisons concurrentes du même événement.
    const seen = await tx.paymentTransaction.findUnique({
      where: { provider_providerEventId: { provider: providerName, providerEventId: event.eventId } },
      select: { id: true },
    });
    if (seen) return { status: "duplicate", paymentId: payment.id };
    try {
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: "WEBHOOK",
          provider: providerName,
          providerEventId: event.eventId,
          amount: event.amount,
          status: event.status,
          payload: event.sanitized as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { status: "duplicate", paymentId: payment.id };
      throw e;
    }
    const current = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });

    if (event.status === "PAID" && event.amount !== current.amount) {
      logger.error("webhook.amount_mismatch", { paymentId: current.id, expected: current.amount, got: event.amount });
      await tx.payment.update({ where: { id: current.id }, data: { status: "FAILED", failureReason: "Montant incohérent" } });
      return { status: "ignored", paymentId: current.id };
    }

    const decision = decidePaymentEvent(current.status as PaymentStatus, event.status);
    if (decision !== "APPLY") return { status: decision === "IGNORE_DUPLICATE" ? "duplicate" : "ignored", paymentId: current.id };

    await tx.payment.update({
      where: { id: current.id },
      data: {
        status: event.status,
        paidAt: event.status === "PAID" ? new Date() : undefined,
        failureReason: event.status === "FAILED" ? event.failureReason ?? "Paiement refusé" : undefined,
      },
    });

    const order = await tx.order.findUniqueOrThrow({ where: { id: current.orderId } });
    if (event.status === "PAID") {
      if (current.purpose === "ORDER") {
        const res = await markOrderPaid(tx, order.id, current.id);
        if (res.alreadyProcessed) {
          // Double paiement : la commande était déjà réglée → remboursement intégral automatique.
          await requestRefund(tx, { orderId: order.id, amount: current.amount, reason: "OTHER", note: "Double paiement détecté", paymentId: current.id });
        }
        for (const itemId of res.refundItemIds) {
          const item = await tx.orderItem.findUniqueOrThrow({ where: { id: itemId } });
          await requestRefund(tx, { orderId: order.id, orderItemId: itemId, amount: item.lineTotal, reason: "ITEM_UNAVAILABLE", note: "Achat groupé clôturé pendant le paiement" });
        }
      } else {
        await applySupplementPaid(tx, current.orderId, current.orderItemId!, current.amount, current.id);
      }
    } else if (event.status === "FAILED") {
      await notify(order.userId, "payment_failed", { number: order.number }, {}, tx);
    }
    return { status: "applied", paymentId: current.id };
  });

  if (result.status === "applied") await processPendingRefunds(db);
  return result;
}

/** Le participant a accepté le prix alternatif et payé le supplément. */
async function applySupplementPaid(tx: Prisma.TransactionClient, orderId: string, orderItemId: string, amount: number, paymentId: string) {
  const item = await tx.orderItem.findUniqueOrThrow({ where: { id: orderItemId }, include: { participant: true } });
  if (!item.participant || item.participant.status !== "AWAITING_DECISION") {
    await requestRefund(tx, { orderId, orderItemId, amount, reason: "OTHER", note: "Supplément reçu hors délai", paymentId });
    return;
  }
  const newUnitPrice = item.unitPrice + Math.round(amount / item.quantity);
  await tx.groupBuyParticipant.update({ where: { id: item.participant.id }, data: { status: "CONFIRMED" } });
  await tx.orderItem.update({
    where: { id: item.id },
    data: { status: "GROUP_CONFIRMED", finalUnitPrice: newUnitPrice, lineTotal: { increment: amount } },
  });
  await tx.order.update({ where: { id: orderId }, data: { total: { increment: amount }, subtotal: { increment: amount } } });
  // committedBase n'est pas modifié : la quantité y figurait déjà avant la clôture.
  await recomputeOrderStatus(tx, orderId, "Prix alternatif accepté", null);
}

// ─── Remboursements ──────────────────────────────────────────

/**
 * Enregistre un remboursement (dans la transaction métier), réparti sur les
 * paiements réglés de la commande. L'appel au prestataire est fait ensuite
 * par processPendingRefunds (hors transaction, rejouable).
 */
export async function requestRefund(
  tx: Prisma.TransactionClient,
  input: { orderId: string; amount: number; reason: RefundReason; orderItemId?: string; note?: string; actorId?: string; paymentId?: string },
) {
  let remaining = input.amount;
  const payments = await tx.payment.findMany({
    where: { orderId: input.orderId, status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, ...(input.paymentId ? { id: input.paymentId } : {}) },
    orderBy: { createdAt: "asc" },
  });
  const created: string[] = [];
  for (const p of payments) {
    if (remaining <= 0) break;
    const avail = refundableAmount({ amount: p.amount, refundedAmount: p.refundedAmount, status: p.status as PaymentStatus });
    const part = Math.min(avail, remaining);
    if (part <= 0) continue;
    const next = statusAfterRefund({ amount: p.amount, refundedAmount: p.refundedAmount, status: p.status as PaymentStatus }, part);
    await tx.payment.update({ where: { id: p.id }, data: next });
    const r = await tx.refund.create({
      data: {
        paymentId: p.id,
        orderId: input.orderId,
        orderItemId: input.orderItemId ?? null,
        amount: part,
        reason: input.reason,
        note: input.note ?? null,
        requestedById: input.actorId ?? null,
      },
    });
    created.push(r.id);
    remaining -= part;
  }
  if (input.orderItemId) {
    await tx.orderItem.update({ where: { id: input.orderItemId }, data: { refundedAmount: { increment: input.amount - remaining } } });
  }
  if (remaining > 0) {
    logger.warn("refund.partial_coverage", { orderId: input.orderId, uncovered: remaining });
  }
  return { refundIds: created, uncovered: remaining };
}

/** Exécute les remboursements en attente auprès du prestataire (idempotent, rejouable). */
export async function processPendingRefunds(db: Db = prisma) {
  const pending = await db.refund.findMany({ where: { status: "PENDING" }, include: { payment: true, order: true }, take: 100 });
  for (const r of pending) {
    try {
      const provider = getPaymentProvider(r.payment.provider);
      const res = await provider.refund({ providerRef: r.payment.providerRef ?? "", amount: r.amount, refundId: r.id, reason: r.reason });
      if (res.status === "PENDING") continue;
      await db.refund.update({
        where: { id: r.id },
        data: { status: res.status, providerRef: res.providerRefundRef, processedAt: new Date() },
      });
      await db.paymentTransaction.upsert({
        where: { provider_providerEventId: { provider: r.payment.provider, providerEventId: `refund_${r.id}` } },
        create: { paymentId: r.paymentId, type: "REFUND", provider: r.payment.provider, providerEventId: `refund_${r.id}`, amount: r.amount, status: res.status, payload: { refundId: r.id } },
        update: {},
      });
      if (res.status === "SUCCEEDED") {
        await notify(r.order.userId, "refund_processed", { amount: r.amount, number: r.order.number }, { channels: ["SMS"] }, db);
      }
    } catch (e) {
      logger.error("refund.failed", { refundId: r.id, error: (e as Error).message });
    }
  }
}

// ─── Simulateur (prestataire « mock ») ───────────────────────

export async function getPaymentForUser(userId: string, paymentId: string, db: Db = prisma) {
  const p = await db.payment.findFirst({ where: { id: paymentId, order: { userId } }, include: { order: { select: { id: true, number: true } } } });
  if (!p) throw new DomainError("NOT_FOUND", "Paiement introuvable.");
  return p;
}

/** Simule la décision de l'utilisateur sur la page de paiement fictive (dev/test uniquement). */
export async function simulateMockPayment(userId: string, paymentId: string, outcome: "PAID" | "FAILED", db: Db = prisma) {
  const p = await getPaymentForUser(userId, paymentId, db);
  if (p.provider !== "mock") throw new DomainError("FORBIDDEN", "Simulation réservée au prestataire de test.");
  const { getMockProvider } = await import("@/infrastructure/payments/registry");
  const mock = getMockProvider();
  const hook = mock.buildWebhook({
    reference: p.providerRef!,
    status: outcome,
    amount: p.amount,
    failureReason: outcome === "FAILED" ? "Solde insuffisant (simulation)" : undefined,
  });
  return handlePaymentWebhook("mock", hook.body, hook.headers, db);
}
