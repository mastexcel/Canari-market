/**
 * CommunityService : communautés d'achat (quartier, résidence, entreprise…).
 */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, type Db } from "@/infrastructure/db";
import { humanCode } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { communityLevel, nextCommunityLevel, slugify } from "@/domain/community";
import { nextWeekday } from "@/domain/dates";
import { orderSavings } from "@/domain/savings";
import type { communitySchema } from "./schemas";
import { track } from "./analytics.service";
import { audit } from "./audit.service";

function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function monthlyOrders(communityId: string, db: Db = prisma, now = new Date()) {
  return db.order.count({ where: { communityId, paidAt: { gte: monthStart(now) }, status: { notIn: ["CANCELLED", "REFUNDED"] } } });
}

export async function communityStats(communityId: string, db: Db = prisma, now = new Date()) {
  const [orders, items, monthly] = await Promise.all([
    db.order.count({ where: { communityId, paidAt: { not: null }, status: { notIn: ["CANCELLED", "REFUNDED"] } } }),
    db.orderItem.findMany({
      where: { order: { communityId, paidAt: { not: null } }, status: { notIn: ["CANCELLED", "REFUNDED"] } },
      select: { quantity: true, referenceUnitPrice: true, unitPrice: true, finalUnitPrice: true, fractionationFee: true },
    }),
    monthlyOrders(communityId, db, now),
  ]);
  return {
    totalOrders: orders,
    totalSavings: orderSavings(items),
    monthlyOrders: monthly,
    level: communityLevel(monthly),
    next: nextCommunityLevel(monthly),
  };
}

/** Communauté de l'utilisateur offrant le meilleur niveau d'avantages. */
export async function bestCommunityForUser(userId: string, db: Db = prisma, now = new Date()) {
  const memberships = await db.communityMember.findMany({ where: { userId }, include: { community: true } });
  let best: { id: string; name: string; pickupPointId: string | null; level: ReturnType<typeof communityLevel> } | null = null;
  for (const m of memberships) {
    const level = communityLevel(await monthlyOrders(m.communityId, db, now));
    if (!best || level.minMonthlyOrders > best.level.minMonthlyOrders) {
      best = { id: m.community.id, name: m.community.name, pickupPointId: m.community.pickupPointId, level };
    }
  }
  return best;
}

export async function listCommunities(params: { commune?: string | null; q?: string }, db: Db = prisma) {
  const communities = await db.community.findMany({
    where: {
      isPublic: true,
      ...(params.q ? { name: { contains: params.q, mode: "insensitive" } } : {}),
    },
    include: { pickupPoint: { select: { name: true } } },
    orderBy: [{ memberCount: "desc" }],
    take: 60,
  });
  // Les communautés de la commune de l'utilisateur d'abord (« proches »).
  return communities.sort((a, b) => Number(b.commune === params.commune) - Number(a.commune === params.commune));
}

export async function getCommunity(slug: string, userId: string | null, db: Db = prisma, now = new Date()) {
  const c = await db.community.findUnique({
    where: { slug },
    include: {
      pickupPoint: true,
      createdBy: { select: { firstName: true } },
      groupBuys: { where: { status: "OPEN" }, select: { slug: true, title: true } },
    },
  });
  if (!c) throw new DomainError("NOT_FOUND", "Communauté introuvable.");
  const membership = userId ? await db.communityMember.findUnique({ where: { communityId_userId: { communityId: c.id, userId } } }) : null;
  const stats = await communityStats(c.id, db, now);
  return {
    ...c,
    stats,
    membership,
    nextDelivery: c.deliveryWeekday !== null ? nextWeekday(c.deliveryWeekday, now) : null,
  };
}

export async function createCommunity(userId: string, input: z.infer<typeof communitySchema>, db: Db = prisma) {
  const base = slugify(input.name.toLowerCase().startsWith("accent") ? input.name : `sesam ${input.name}`);
  let slug = base;
  for (let i = 2; await db.community.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  if (input.pickupPointId) {
    const p = await db.pickupPoint.findFirst({ where: { id: input.pickupPointId, isActive: true } });
    if (!p) throw new DomainError("VALIDATION", "Point relais introuvable.");
  }
  try {
    const community = await db.community.create({
      data: {
        slug,
        name: input.name.toLowerCase().startsWith("accent") ? input.name : `Sesam ${input.name}`,
        type: input.type,
        commune: input.commune,
        quartier: input.quartier || null,
        description: input.description || null,
        pickupPointId: input.pickupPointId || null,
        deliveryWeekday: input.deliveryWeekday ?? null,
        isPublic: input.isPublic,
        inviteCode: humanCode(8),
        createdById: userId,
        memberCount: 1,
        members: { create: { userId, role: "ADMIN" } },
      },
    });
    await audit({ actorId: userId, action: "community.create", entityType: "Community", entityId: community.id, after: { name: community.name } }, db);
    await track("community_joined", userId, { communityId: community.id, creator: true }, db);
    return community;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new DomainError("CONFLICT", "Ce nom est déjà pris.");
    throw e;
  }
}

export async function joinCommunity(userId: string, communityId: string, inviteCode: string | null, db: Db = prisma) {
  const c = await db.community.findUnique({ where: { id: communityId } });
  if (!c) throw new DomainError("NOT_FOUND", "Communauté introuvable.");
  if (!c.isPublic && c.inviteCode !== inviteCode) throw new DomainError("FORBIDDEN", "Cette communauté est privée : un code d'invitation est nécessaire.");
  const existing = await db.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
  if (existing) return existing;
  const m = await db.communityMember.create({ data: { communityId, userId } });
  await db.community.update({ where: { id: communityId }, data: { memberCount: { increment: 1 } } });
  await track("community_joined", userId, { communityId }, db);
  return m;
}

export async function leaveCommunity(userId: string, communityId: string, db: Db = prisma) {
  const m = await db.communityMember.findUnique({ where: { communityId_userId: { communityId, userId } } });
  if (!m) return;
  if (m.role === "ADMIN") {
    const admins = await db.communityMember.count({ where: { communityId, role: "ADMIN" } });
    if (admins <= 1) throw new DomainError("INVALID_STATE", "Désignez un autre administrateur avant de quitter la communauté.");
  }
  await db.communityMember.delete({ where: { id: m.id } });
  await db.community.update({ where: { id: communityId }, data: { memberCount: { decrement: 1 } } });
}

export async function userCommunities(userId: string, db: Db = prisma) {
  return db.communityMember.findMany({ where: { userId }, include: { community: true } });
}
