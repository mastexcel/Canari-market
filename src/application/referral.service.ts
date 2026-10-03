/** Parrainage : récompenses en avoir, déclenchées par une vraie commande livrée. */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { evaluateReferral } from "@/domain/referral";
import { notify } from "./notification.service";
import { audit } from "./audit.service";

export async function evaluateReferralForOrder(orderId: string, db: Db = prisma, now = new Date()) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: { select: { refundedAmount: true } } } });
  if (!order) return null;
  const referral = await db.referral.findUnique({ where: { refereeId: order.userId } });
  if (!referral) return null;
  const deliveredCount = await db.order.count({ where: { userId: order.userId, status: "DELIVERED" } });
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rewardsThisMonth = await db.referral.count({ where: { referrerId: referral.referrerId, status: "REWARDED", rewardedAt: { gte: monthStart } } });
  const decision = evaluateReferral({
    referrerId: referral.referrerId,
    refereeId: referral.refereeId,
    referralStatus: referral.status,
    order: {
      status: order.status,
      total: order.total,
      refundedAmount: order.items.reduce((s, i) => s + i.refundedAmount, 0),
      isFirstDeliveredOrder: deliveredCount === 1,
    },
    referrerRewardsThisMonth: rewardsThisMonth,
  });
  if (!decision.qualifies) return decision;
  await inTransaction(db, async (tx) => {
    const updated = await tx.referral.updateMany({
      where: { id: referral.id, status: "PENDING" },
      data: { status: "REWARDED", rewardAmount: decision.referrerReward, qualifyingOrderId: orderId, rewardedAt: now },
    });
    if (updated.count === 0) return; // déjà traité (concurrence)
    await tx.creditLedgerEntry.createMany({
      data: [
        { userId: referral.referrerId, amount: decision.referrerReward, reason: "REFERRAL_REWARD", orderId, note: "Parrainage : filleul livré" },
        { userId: referral.refereeId, amount: decision.refereeReward, reason: "REFERRAL_REWARD", orderId, note: "Bienvenue chez CANARI" },
      ],
    });
    await notify(referral.referrerId, "referral_rewarded", { amount: decision.referrerReward }, {}, tx);
    await notify(referral.refereeId, "referral_rewarded", { amount: decision.refereeReward }, {}, tx);
    await audit({ action: "referral.reward", entityType: "Referral", entityId: referral.id, after: decision }, tx);
  });
  return decision;
}

export async function referralSummary(userId: string, db: Db = prisma) {
  const [user, referrals] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } }),
    db.referral.findMany({ where: { referrerId: userId }, include: { referee: { select: { firstName: true, createdAt: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    code: user.referralCode,
    referrals,
    rewarded: referrals.filter((r) => r.status === "REWARDED").reduce((s, r) => s + r.rewardAmount, 0),
    pending: referrals.filter((r) => r.status === "PENDING").length,
  };
}
