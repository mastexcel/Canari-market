/** Avoirs CANARI (crédit utilisable sur une prochaine commande). */
import { prisma, type Db } from "@/infrastructure/db";

export async function creditBalance(userId: string, db: Db = prisma): Promise<number> {
  const agg = await db.creditLedgerEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return Math.max(0, agg._sum.amount ?? 0);
}

export async function creditHistory(userId: string, db: Db = prisma) {
  return db.creditLedgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
}
