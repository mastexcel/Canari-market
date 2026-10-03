/**
 * Notifications : in-app systématique + canaux sortants (push, SMS, WhatsApp,
 * e-mail) via adaptateurs. Les messages marketing respectent le consentement.
 */
import type { NotificationChannel, Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { getChannelAdapter } from "@/infrastructure/notifications/channels";
import { logger } from "@/infrastructure/logger";
import { formatFcfa } from "@/domain/money";

type Vars = Record<string, string | number>;

export const TEMPLATES = {
  group_progress: (v: Vars) => ({
    title: "Achat groupé presque complet",
    body: `« ${v.title} » est à ${v.percent} %. Encore ${v.remaining} pour débloquer le prochain prix.`,
  }),
  group_confirmed: (v: Vars) => ({
    title: "Achat groupé confirmé 🎉",
    body: `« ${v.title} » a atteint son seuil. Prix final : ${formatFcfa(Number(v.unitPrice))} ${v.unitLabel}.${Number(v.refund) > 0 ? ` ${formatFcfa(Number(v.refund))} vous sont remboursés.` : ""}`,
  }),
  group_failed_refund: (v: Vars) => ({
    title: "Achat groupé non abouti",
    body: `« ${v.title} » n'a pas atteint son seuil. ${formatFcfa(Number(v.amount))} vous sont remboursés.`,
  }),
  group_failed_credit: (v: Vars) => ({
    title: "Achat groupé non abouti",
    body: `« ${v.title} » n'a pas atteint son seuil. Comme vous l'avez choisi, ${formatFcfa(Number(v.amount))} sont crédités sur votre avoir Sesam-Market.`,
  }),
  group_alternative: (v: Vars) => ({
    title: "Une proposition pour votre achat",
    body: `« ${v.title} » n'a pas atteint son seuil. Sesam-Market vous propose un prix alternatif : acceptez ou soyez remboursé.`,
  }),
  group_extended: (v: Vars) => ({
    title: "Achat groupé prolongé",
    body: `« ${v.title} » est prolongé jusqu'au ${v.date}. Invitez vos proches pour atteindre le seuil !`,
  }),
  payment_confirmed: (v: Vars) => ({
    title: "Paiement confirmé",
    body: `Commande ${v.number} payée (${formatFcfa(Number(v.amount))}). Économie prévue : ${formatFcfa(Number(v.savings))}.`,
  }),
  payment_failed: (v: Vars) => ({
    title: "Paiement échoué",
    body: `Le paiement de la commande ${v.number} a échoué. Vous pouvez réessayer depuis vos commandes.`,
  }),
  order_ready_pickup: (v: Vars) => ({
    title: "Votre commande est prête",
    body: `Commande ${v.number} disponible au ${v.point}. Code de retrait : ${v.code}.`,
  }),
  order_out_for_delivery: (v: Vars) => ({
    title: "Votre livreur arrive",
    body: `Commande ${v.number} en route. Donnez le code ${v.code} au livreur à la réception.`,
  }),
  order_delivered: (v: Vars) => ({
    title: "Commande livrée",
    body: `Merci ! Avec cette commande, vous avez économisé ${formatFcfa(Number(v.savings))}.`,
  }),
  refund_processed: (v: Vars) => ({
    title: "Remboursement effectué",
    body: `${formatFcfa(Number(v.amount))} remboursés sur la commande ${v.number}.`,
  }),
  referral_rewarded: (v: Vars) => ({
    title: "Parrainage récompensé",
    body: `${formatFcfa(Number(v.amount))} crédités sur votre avoir Sesam-Market. Merci de faire grandir le groupe !`,
  }),
  rfq_opened: (v: Vars) => ({
    title: "Nouvelle demande de cotation",
    body: `RFQ ${v.number} : ${v.quantity} de ${v.product}. Réponse avant le ${v.date}.`,
  }),
  po_received: (v: Vars) => ({
    title: "Nouveau bon de commande",
    body: `Bon de commande ${v.number} (${formatFcfa(Number(v.amount))}) à confirmer.`,
  }),
  mission_assigned: (v: Vars) => ({
    title: "Nouvelle mission",
    body: `Livraison ${v.number} à ${v.commune}. Gain : ${formatFcfa(Number(v.fee))}.`,
  }),
  parcel_incoming: (v: Vars) => ({
    title: "Colis en route vers votre point",
    body: `Commande ${v.number} arrive au point relais.`,
  }),
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

export interface NotifyOptions {
  /** Canaux sortants en plus de l'in-app. */
  channels?: Exclude<NotificationChannel, "IN_APP">[];
  data?: Record<string, string | number>;
}

export async function notify(
  userId: string,
  template: TemplateKey,
  vars: Vars,
  opts: NotifyOptions = {},
  db: Db = prisma,
): Promise<void> {
  const { title, body } = TEMPLATES[template](vars);
  const data = (opts.data ?? {}) as Prisma.InputJsonValue;
  await db.notification.create({
    data: { userId, channel: "IN_APP", template, title, body, data, status: "SENT", sentAt: new Date() },
  });
  for (const channel of opts.channels ?? []) {
    await db.notification.create({ data: { userId, channel, template, title, body, data, status: "QUEUED" } });
  }
}

/** Envoie les notifications sortantes en file (tâche planifiée). */
export async function dispatchQueuedNotifications(limit = 200, db: Db = prisma): Promise<number> {
  const queued = await db.notification.findMany({
    where: { status: "QUEUED", channel: { not: "IN_APP" } },
    include: { user: { select: { phone: true, email: true, status: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const n of queued) {
    if (n.user.status === "DELETED") {
      await db.notification.update({ where: { id: n.id }, data: { status: "FAILED" } });
      continue;
    }
    const to = n.channel === "EMAIL" ? n.user.email : n.user.phone;
    if (!to) {
      await db.notification.update({ where: { id: n.id }, data: { status: "FAILED" } });
      continue;
    }
    const res = await getChannelAdapter(n.channel as "PUSH" | "SMS" | "WHATSAPP" | "EMAIL").send({ to, title: n.title, body: n.body });
    await db.notification.update({
      where: { id: n.id },
      data: { status: res.ok ? "SENT" : "FAILED", sentAt: res.ok ? new Date() : null },
    });
    if (res.ok) sent++;
    else logger.warn("notification.failed", { id: n.id, error: res.error });
  }
  return sent;
}

export async function listNotifications(userId: string, db: Db = prisma) {
  return db.notification.findMany({
    where: { userId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function unreadCount(userId: string, db: Db = prisma) {
  return db.notification.count({ where: { userId, channel: "IN_APP", readAt: null } });
}

export async function markAllRead(userId: string, db: Db = prisma) {
  await db.notification.updateMany({
    where: { userId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date(), status: "READ" },
  });
}
