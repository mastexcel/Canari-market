/**
 * Enveloppe commune des routes API v1 :
 *  - authentification (cookie de session OU en-tête Bearer pour les apps mobiles) ;
 *  - contrôle de rôle / permission (RBAC) ;
 *  - protection CSRF par vérification d'origine sur les mutations cookie ;
 *  - limitation de débit ;
 *  - validation zod ;
 *  - idempotence (en-tête Idempotency-Key) ;
 *  - traduction des erreurs métier en réponses JSON stables.
 */
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { DomainError } from "@/domain/errors";
import { hasPermission, type AdminPermission, type UserRole } from "@/domain/permissions";
import { getUserBySessionToken, SESSION_COOKIE, type SessionUser } from "@/application/auth.service";
import { rateLimiter } from "../rate-limit";
import { logger } from "../logger";
import { prisma } from "../db";
import { sha256 } from "../crypto";

export interface HandlerContext<P = Record<string, string>> {
  req: NextRequest;
  user: SessionUser | null;
  params: P;
  ip: string;
  idempotencyKey: string | null;
}

export interface HandlerOptions {
  auth?: boolean;
  roles?: UserRole[];
  permission?: AdminPermission;
  rateLimit?: { limit: number; windowMs: number; key?: "ip" | "user" };
  /** Rejoue la réponse précédente si la même Idempotency-Key est renvoyée */
  idempotent?: string;
  /** Route appelée par un tiers (webhook, cron) : pas de contrôle d'origine */
  external?: boolean;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

function tokenFrom(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function originAllowed(req: NextRequest): boolean {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return true; // pas de cookie ambiant
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof DomainError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.httpStatus });
  }
  if (e instanceof ZodError) {
    const issues = e.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return NextResponse.json({ error: { code: "VALIDATION", message: issues[0]?.message ?? "Données invalides.", issues } }, { status: 400 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Ressource introuvable." } }, { status: 404 });
  }
  logger.error("api.unhandled", { error: (e as Error)?.message, stack: (e as Error)?.stack?.split("\n").slice(0, 4).join(" | ") });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Une erreur est survenue. Réessayez." } }, { status: 500 });
}

type RouteCtx = { params: Promise<Record<string, string>> };

export function route<P = Record<string, string>>(
  opts: HandlerOptions,
  fn: (ctx: HandlerContext<P>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: RouteCtx): Promise<NextResponse> => {
    try {
      const ip = clientIp(req);
      if (MUTATING.has(req.method) && !opts.external && !originAllowed(req)) {
        throw new DomainError("FORBIDDEN", "Origine de la requête refusée.");
      }
      const user = opts.external ? null : await getUserBySessionToken(tokenFrom(req));
      if ((opts.auth || opts.roles || opts.permission) && !user) throw new DomainError("UNAUTHENTICATED", "Connectez-vous pour continuer.");
      if (opts.roles && user && !opts.roles.includes(user.role)) throw new DomainError("FORBIDDEN", "Accès non autorisé.");
      if (opts.permission && !hasPermission(user, opts.permission)) throw new DomainError("FORBIDDEN", "Permission insuffisante.");
      if (opts.rateLimit) {
        const key = `${req.nextUrl.pathname}:${opts.rateLimit.key === "user" && user ? user.id : ip}`;
        const r = rateLimiter.hit(key, opts.rateLimit.limit, opts.rateLimit.windowMs);
        if (!r.allowed) throw new DomainError("RATE_LIMITED", "Trop de requêtes. Patientez un instant.");
      }
      const params = ((await routeCtx?.params) ?? {}) as P;
      const idempotencyKey = req.headers.get("idempotency-key")?.slice(0, 100) ?? null;

      if (opts.idempotent && idempotencyKey && user) {
        const prior = await prisma.idempotencyKey.findUnique({ where: { userId_scope_key: { userId: user.id, scope: opts.idempotent, key: idempotencyKey } } });
        if (prior) return NextResponse.json(prior.responseBody, { status: prior.responseStatus, headers: { "idempotent-replay": "true" } });
      }

      const result = await fn({ req, user, params, ip, idempotencyKey });
      if (result instanceof NextResponse) return result;
      const body = result ?? { ok: true };

      if (opts.idempotent && idempotencyKey && user) {
        await prisma.idempotencyKey
          .create({
            data: { userId: user.id, scope: opts.idempotent, key: idempotencyKey, requestHash: sha256(req.nextUrl.pathname), responseStatus: 200, responseBody: body as Prisma.InputJsonValue },
          })
          .catch(() => undefined);
      }
      return NextResponse.json(body);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new DomainError("VALIDATION", "Corps de requête JSON invalide.");
  }
  return schema.parse(json);
}
