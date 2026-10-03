/**
 * SavingsService — KPI principal : économie réelle générée pour les ménages.
 * Seules les lignes payées, non annulées/remboursées, comptent.
 */
import { prisma, type Db } from "@/infrastructure/db";
import { lineSavings, summarizeSavings } from "@/domain/savings";

const countedStatuses = { notIn: ["CANCELLED", "REFUNDED", "PENDING_PAYMENT", "DRAFT"] as const };

export async function userSavings(userId: string, db: Db = prisma, now = new Date()) {
  const items = await db.orderItem.findMany({
    where: { order: { userId, paidAt: { not: null } }, status: { notIn: [...countedStatuses.notIn] } },
    select: { quantity: true, referenceUnitPrice: true, unitPrice: true, finalUnitPrice: true, fractionationFee: true, order: { select: { paidAt: true, id: true, number: true } } },
  });
  const entries = items.map((i) => ({ date: i.order.paidAt!, amount: lineSavings(i) }));
  const summary = summarizeSavings(entries, now, 6);
  const lastOrder = await db.order.findFirst({
    where: { userId, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
    orderBy: { paidAt: "desc" },
    select: { id: true, number: true, savingsTotal: true },
  });
  return { ...summary, lastOrder };
}

/** Économie cumulée de toute la communauté Sesam-Market (page d'accueil). */
export async function platformSavings(db: Db = prisma) {
  const items = await db.orderItem.findMany({
    where: { order: { paidAt: { not: null } }, status: { notIn: [...countedStatuses.notIn] } },
    select: { quantity: true, referenceUnitPrice: true, unitPrice: true, finalUnitPrice: true, fractionationFee: true },
  });
  const households = await db.order.findMany({ where: { paidAt: { not: null } }, select: { userId: true }, distinct: ["userId"] });
  const total = items.reduce((s, i) => s + lineSavings(i), 0);
  return { total, households: households.length, average: households.length ? Math.round(total / households.length) : 0 };
}
