/**
 * Authentification par téléphone + mot de passe, sessions opaques en base.
 * Le jeton n'est jamais stocké en clair (seulement son SHA-256).
 */
import { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import { humanCode, randomToken, sha256 } from "@/infrastructure/crypto";
import { DomainError } from "@/domain/errors";
import { normalizeIvorianPhone } from "@/domain/phone";
import type { SignupInput } from "./schemas";
import { track } from "./analytics.service";

export const SESSION_COOKIE = "canari_session";
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const CONSENT_VERSION = "2026-10";

export const sessionUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  adminPermissions: true,
  status: true,
  commune: true,
  quartier: true,
  referralCode: true,
} satisfies Prisma.UserSelect;

export type SessionUser = Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>;

async function uniqueReferralCode(db: Db): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = `CAN${humanCode(5)}`;
    if (!(await db.user.findUnique({ where: { referralCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Impossible de générer un code de parrainage unique.");
}

export async function signup(input: SignupInput, meta: { ip?: string | null } = {}, db: Db = prisma) {
  const phone = normalizeIvorianPhone(input.phone);
  if (await db.user.findUnique({ where: { phone }, select: { id: true } })) {
    throw new DomainError("CONFLICT", "Un compte existe déjà avec ce numéro. Connectez-vous.");
  }
  let referrerId: string | null = null;
  if (input.referralCode) {
    const ref = await db.user.findUnique({ where: { referralCode: input.referralCode.toUpperCase() }, select: { id: true } });
    if (!ref) throw new DomainError("VALIDATION", "Code de parrainage inconnu.");
    referrerId = ref.id;
  }
  const passwordHash = await hashPassword(input.password);
  const referralCode = await uniqueReferralCode(db);

  try {
    const user = await db.user.create({
      data: {
        phone,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName || null,
        role: input.accountType,
        commune: input.commune,
        quartier: input.quartier,
        referralCode,
        referredById: referrerId,
        household: input.accountType === "HOUSEHOLD" ? { create: { adults: input.adults, children: input.children } } : undefined,
        merchant:
          input.accountType === "MERCHANT"
            ? { create: { businessName: input.businessName || input.firstName, businessType: "Boutique", commune: input.commune, quartier: input.quartier } }
            : undefined,
        consents: {
          create: [
            { type: "TERMS", granted: true, version: CONSENT_VERSION, ip: meta.ip ?? null },
            { type: "PRIVACY", granted: true, version: CONSENT_VERSION, ip: meta.ip ?? null },
            { type: "MARKETING_SMS", granted: input.marketingSms, version: CONSENT_VERSION, ip: meta.ip ?? null },
            { type: "MARKETING_WHATSAPP", granted: input.marketingWhatsapp, version: CONSENT_VERSION, ip: meta.ip ?? null },
          ],
        },
        referralReceived: referrerId ? { create: { referrerId } } : undefined,
      },
      select: sessionUserSelect,
    });
    await track("signup_completed", user.id, { role: user.role, referred: !!referrerId }, db);
    return user;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new DomainError("CONFLICT", "Un compte existe déjà avec ce numéro.");
    }
    throw e;
  }
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}, db: Db = prisma) {
  const token = randomToken(32);
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 200) ?? null,
    },
  });
  return { token, expiresAt: new Date(Date.now() + SESSION_TTL_MS) };
}

let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword("canari-dummy-password-1"));

/** Message volontairement identique (numéro inconnu / mauvais mot de passe) pour éviter l'énumération. */
const BAD_CREDENTIALS = "Numéro ou mot de passe incorrect.";

export async function login(phoneInput: string, password: string, db: Db = prisma) {
  let phone: string;
  try {
    phone = normalizeIvorianPhone(phoneInput);
  } catch {
    throw new DomainError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  const user = await db.user.findUnique({ where: { phone } });
  if (!user || user.status === "DELETED") {
    await verifyPassword(password, await dummyHash()); // temps de réponse constant
    throw new DomainError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  if (user.status === "SUSPENDED") throw new DomainError("FORBIDDEN", "Ce compte est suspendu. Contactez le support.");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new DomainError("RATE_LIMITED", "Trop de tentatives. Réessayez dans 15 minutes.");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLoginCount + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MS) : null,
      },
    });
    throw new DomainError("UNAUTHENTICATED", BAD_CREDENTIALS);
  }
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return db.user.findUniqueOrThrow({ where: { id: user.id }, select: sessionUserSelect });
}

export async function getUserBySessionToken(token: string | undefined | null, db: Db = prisma): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: sessionUserSelect } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (session.user.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 3_600_000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return session.user;
}

export async function logout(token: string | undefined | null, db: Db = prisma) {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export async function changePassword(userId: string, current: string, next: string, db: Db = prisma) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new DomainError("VALIDATION", "Mot de passe actuel incorrect.");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId } });
}
