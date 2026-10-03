/** Accès à la session dans les Server Components / layouts. */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionToken, SESSION_COOKIE, type SessionUser } from "@/application/auth.service";
import { hasPermission, homePathFor, type AdminPermission, type UserRole } from "@/domain/permissions";

/** Mémorisé pour la durée d'une requête : layout et page partagent une seule lecture. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getUserBySessionToken(token);
});

export async function requireUser(next = "/"): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/connexion?suite=${encodeURIComponent(next)}`);
  return user;
}

export async function requireRole(roles: UserRole[], next = "/"): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

export async function requirePermission(permission: AdminPermission, next = "/admin"): Promise<SessionUser> {
  const user = await requireRole(["ADMIN"], next);
  if (!hasPermission(user, permission)) redirect("/admin?refus=1");
  return user;
}
