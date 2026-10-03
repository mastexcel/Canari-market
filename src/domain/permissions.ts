/**
 * Contrôle d'accès (RBAC) + permissions administratives granulaires.
 */
export type UserRole = "HOUSEHOLD" | "MERCHANT" | "SUPPLIER" | "PICKUP_POINT" | "DRIVER" | "ADMIN";

export type AdminPermission =
  | "SUPER_ADMIN"
  | "USERS_MANAGE"
  | "SUPPLIERS_MANAGE"
  | "CATALOG_MANAGE"
  | "PRICING_MANAGE"
  | "GROUPBUYS_MANAGE"
  | "ORDERS_MANAGE"
  | "PAYMENTS_MANAGE"
  | "REFUNDS_MANAGE"
  | "LOGISTICS_MANAGE"
  | "COMMUNITIES_MANAGE"
  | "PROMOTIONS_MANAGE"
  | "SUPPORT_MANAGE"
  | "ANALYTICS_VIEW"
  | "AUDIT_VIEW";

export interface Actor {
  id: string;
  role: UserRole;
  adminPermissions: readonly AdminPermission[];
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
}

export function hasPermission(actor: Actor | null | undefined, permission: AdminPermission): boolean {
  if (!actor || actor.role !== "ADMIN" || actor.status === "SUSPENDED" || actor.status === "DELETED") return false;
  return actor.adminPermissions.includes("SUPER_ADMIN") || actor.adminPermissions.includes(permission);
}

/** Rôles autorisés à acheter (passer commande). */
export function canPurchase(actor: Actor | null | undefined): boolean {
  return !!actor && actor.status !== "SUSPENDED" && (actor.role === "HOUSEHOLD" || actor.role === "MERCHANT" || actor.role === "ADMIN");
}

export function hasRole(actor: Actor | null | undefined, ...roles: UserRole[]): boolean {
  return !!actor && actor.status !== "SUSPENDED" && actor.status !== "DELETED" && roles.includes(actor.role);
}

/** Espace d'accueil par rôle. */
export function homePathFor(role: UserRole): string {
  switch (role) {
    case "SUPPLIER":
      return "/fournisseur";
    case "DRIVER":
      return "/livreur";
    case "PICKUP_POINT":
      return "/point-relais";
    case "ADMIN":
      return "/admin";
    default:
      return "/";
  }
}

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  SUPER_ADMIN: "Super administrateur",
  USERS_MANAGE: "Utilisateurs",
  SUPPLIERS_MANAGE: "Fournisseurs",
  CATALOG_MANAGE: "Catalogue",
  PRICING_MANAGE: "Prix",
  GROUPBUYS_MANAGE: "Achats groupés",
  ORDERS_MANAGE: "Commandes",
  PAYMENTS_MANAGE: "Paiements",
  REFUNDS_MANAGE: "Remboursements",
  LOGISTICS_MANAGE: "Logistique",
  COMMUNITIES_MANAGE: "Communautés",
  PROMOTIONS_MANAGE: "Promotions",
  SUPPORT_MANAGE: "Support",
  ANALYTICS_VIEW: "Statistiques",
  AUDIT_VIEW: "Journal d'audit",
};
