/**
 * Notifications push : abonnement des appareils et remise des messages.
 * Un appareil n'est enregistré que sur action explicite de l'utilisateur
 * (bouton « Activer les notifications » ou autorisation dans l'application).
 */
import { z } from "zod";
import { prisma, type Db } from "@/infrastructure/db";
import { pushConfigured, sendPush, type PushPayload } from "@/infrastructure/notifications/push";
import { logger } from "@/infrastructure/logger";

export const pushDeviceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("WEB"),
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  z.object({ kind: z.literal("FCM"), endpoint: z.string().min(20).max(4096) }),
]);
export type PushDeviceInput = z.infer<typeof pushDeviceSchema>;

/** Au-delà de ce nombre d'échecs consécutifs, l'appareil est retiré. */
const MAX_FAILURES = 5;

export async function registerPushDevice(userId: string, input: PushDeviceInput, userAgent: string | null, db: Db = prisma) {
  const keys = input.kind === "WEB" ? { p256dh: input.keys.p256dh, auth: input.keys.auth } : { p256dh: null, auth: null };
  // Un même appareil peut changer de compte : l'abonnement suit le dernier utilisateur connecté.
  return db.pushDevice.upsert({
    where: { endpoint: input.endpoint },
    update: { userId, kind: input.kind, ...keys, userAgent: userAgent?.slice(0, 300), failures: 0, lastSeenAt: new Date() },
    create: { userId, kind: input.kind, endpoint: input.endpoint, ...keys, userAgent: userAgent?.slice(0, 300) },
  });
}

export async function unregisterPushDevice(userId: string, endpoint: string, db: Db = prisma) {
  const { count } = await db.pushDevice.deleteMany({ where: { userId, endpoint } });
  return count > 0;
}

export async function hasPushDevice(userId: string, db: Db = prisma) {
  return (await db.pushDevice.count({ where: { userId } })) > 0;
}

/** Envoie à tous les appareils de l'utilisateur ; retourne le nombre d'appareils atteints. */
export async function deliverPush(userId: string, payload: PushPayload, db: Db = prisma): Promise<number> {
  // Seuls les canaux configurés sur le serveur sont tentés : un appareil n'est jamais
  // retiré parce qu'une clé manque côté serveur.
  const cfg = pushConfigured();
  const kinds = [...(cfg.web ? (["WEB"] as const) : []), ...(cfg.fcm ? (["FCM"] as const) : [])];
  if (!kinds.length) return 0;
  const devices = await db.pushDevice.findMany({ where: { userId, kind: { in: kinds } } });
  let reached = 0;
  for (const d of devices) {
    const res = await sendPush(d, payload);
    if (res.ok) {
      reached++;
      await db.pushDevice.update({ where: { id: d.id }, data: { failures: 0, lastSeenAt: new Date() } });
    } else if (res.gone || d.failures + 1 >= MAX_FAILURES) {
      await db.pushDevice.delete({ where: { id: d.id } }).catch(() => undefined);
      logger.info("push.device_removed", { kind: d.kind, reason: res.gone ? "expiré" : "échecs répétés" });
    } else {
      await db.pushDevice.update({ where: { id: d.id }, data: { failures: { increment: 1 } } });
    }
  }
  return reached;
}
