import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";

export const ANALYTICS_EVENTS = [
  "signup_completed",
  "product_viewed",
  "group_buy_viewed",
  "group_buy_joined",
  "cart_created",
  "checkout_started",
  "payment_completed",
  "order_delivered",
  "referral_shared",
  "community_joined",
  "repeat_purchase",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** Étapes du funnel principal, dans l'ordre. */
export const FUNNEL_STEPS: AnalyticsEventName[] = [
  "group_buy_viewed",
  "group_buy_joined",
  "checkout_started",
  "payment_completed",
  "order_delivered",
];

/**
 * Enregistre un événement produit. `props` ne doit contenir AUCUNE donnée
 * personnelle (pas de nom, téléphone, adresse) : uniquement des identifiants
 * techniques et des montants.
 */
export async function track(
  name: AnalyticsEventName,
  userId: string | null,
  props: Record<string, string | number | boolean | null> = {},
  db: Db = prisma,
): Promise<void> {
  try {
    await db.analyticsEvent.create({ data: { name, userId, props: props as Prisma.InputJsonValue } });
  } catch {
    // L'analytique ne doit jamais casser un parcours utilisateur.
  }
}

/** Funnel : utilisateurs distincts ayant atteint chaque étape sur la période. */
export async function funnel(since: Date, db: Db = prisma) {
  const rows = await db.analyticsEvent.groupBy({
    by: ["name", "userId"],
    where: { createdAt: { gte: since }, name: { in: FUNNEL_STEPS }, userId: { not: null } },
  });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  return FUNNEL_STEPS.map((step, i) => {
    const users = counts.get(step) ?? 0;
    const prev = i === 0 ? users : counts.get(FUNNEL_STEPS[i - 1]) ?? 0;
    return { step, users, conversionFromPrevious: prev > 0 ? users / prev : 0 };
  });
}
