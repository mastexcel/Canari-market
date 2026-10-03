/**
 * Tâches planifiées (à déclencher toutes les 5–15 min par un cron externe
 * via POST /api/v1/jobs/run, ou `npm run jobs`).
 */
import { prisma, type Db } from "@/infrastructure/db";
import { logger } from "@/infrastructure/logger";
import { expireAlternativeDecisions, runDeadlines } from "./group-buy.service";
import { expireUnpaidOrders } from "./order.service";
import { processPendingRefunds } from "./payment.service";
import { dispatchQueuedNotifications } from "./notification.service";

export async function runScheduledJobs(db: Db = prisma, now = new Date()) {
  const result: Record<string, unknown> = {};
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["expiredPayments", async () => (await db.payment.updateMany({ where: { status: "PENDING", expiresAt: { lt: now } }, data: { status: "FAILED", failureReason: "Expiré" } })).count],
    ["unpaidOrders", () => expireUnpaidOrders(db, now)],
    ["deadlines", () => runDeadlines(db, now)],
    ["alternativeDecisions", () => expireAlternativeDecisions(db, now)],
    ["refunds", () => processPendingRefunds(db)],
    ["notifications", () => dispatchQueuedNotifications(200, db)],
    ["sessions", async () => (await db.session.deleteMany({ where: { expiresAt: { lt: now } } })).count],
    ["idempotencyKeys", async () => (await db.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } } })).count],
  ];
  for (const [name, fn] of steps) {
    try {
      result[name] = await fn();
    } catch (e) {
      // Une étape en échec n'empêche pas les suivantes.
      logger.error("job.failed", { job: name, error: (e as Error).message });
      result[name] = { error: (e as Error).message };
    }
  }
  return result;
}
