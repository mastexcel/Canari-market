/**
 * Confidentialité (privacy-by-design) : consentements, export, suppression.
 * La suppression pseudonymise le compte : les données transactionnelles sont
 * conservées pour les obligations comptables (10 ans) mais détachées de
 * l'identité (nom, téléphone, e-mail, adresses effacés).
 */
import type { ConsentType } from "@prisma/client";
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { randomToken, sha256 } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { verifyPassword } from "@/infrastructure/auth/password";
import { CONSENT_VERSION } from "./auth.service";
import { audit } from "./audit.service";

export async function currentConsents(userId: string, db: Db = prisma) {
  const records = await db.consentRecord.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const latest = new Map<ConsentType, (typeof records)[number]>();
  for (const r of records) if (!latest.has(r.type)) latest.set(r.type, r);
  return { latest: Object.fromEntries(latest), history: records };
}

export async function setConsent(userId: string, type: ConsentType, granted: boolean, ip: string | null, db: Db = prisma) {
  if ((type === "TERMS" || type === "PRIVACY") && !granted) {
    throw new DomainError("VALIDATION", "Ces conditions sont nécessaires au service : supprimez votre compte pour les retirer.");
  }
  await db.consentRecord.create({ data: { userId, type, granted, version: CONSENT_VERSION, ip } });
}

/** Export de toutes les données personnelles de l'utilisateur (JSON portable). */
export async function exportUserData(userId: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, phone: true, email: true, firstName: true, lastName: true, role: true, commune: true, quartier: true, referralCode: true, createdAt: true,
      household: true, merchant: true, addresses: true, consents: true,
      orders: { include: { items: true, payments: { select: { id: true, amount: true, status: true, method: true, operator: true, createdAt: true, paidAt: true } }, refunds: true, delivery: true } },
      communityMembers: { include: { community: { select: { name: true } } } },
      notifications: { select: { title: true, body: true, createdAt: true, channel: true } },
      reviews: true,
      tickets: { include: { messages: true } },
      creditEntries: true,
      referralsMade: { select: { createdAt: true, status: true, rewardAmount: true } },
    },
  });
  await audit({ actorId: userId, action: "privacy.export", entityType: "User", entityId: userId }, db);
  return { exportedAt: new Date().toISOString(), format: "canari-export-v1", data: user };
}

export async function deleteAccount(userId: string, password: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new DomainError("VALIDATION", "Mot de passe incorrect.");
  const active = await db.order.count({
    where: { userId, status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED", "PENDING_PAYMENT", "DRAFT"] } },
  });
  if (active > 0) throw new DomainError("INVALID_STATE", "Vous avez des commandes en cours : attendez leur livraison ou annulez-les avant de supprimer votre compte.");
  if (user.role !== "HOUSEHOLD" && user.role !== "MERCHANT") throw new DomainError("FORBIDDEN", "Les comptes professionnels sont clôturés par le support.");

  await inTransaction(db, async (tx) => {
    const pseudo = `deleted-${sha256(user.id).slice(0, 12)}`;
    await tx.session.deleteMany({ where: { userId } });
    await tx.address.deleteMany({ where: { userId } });
    await tx.cart.deleteMany({ where: { userId } });
    await tx.communityMember.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.household.deleteMany({ where: { userId } });
    await tx.merchant.deleteMany({ where: { userId } });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "DELETED",
        deletedAt: new Date(),
        firstName: "Utilisateur supprimé",
        lastName: null,
        email: null,
        phone: `+000${sha256(user.id).slice(0, 12)}`,
        passwordHash: sha256(randomToken()),
        commune: null,
        quartier: null,
        referralCode: pseudo.toUpperCase().slice(0, 20),
      },
    });
    await audit({ actorId: null, action: "privacy.delete", entityType: "User", entityId: userId }, tx);
  });
}
