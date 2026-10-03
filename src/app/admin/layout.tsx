import { requireRole } from "@/lib/session";
import { hasPermission, type AdminPermission } from "@/domain/permissions";
import { ProShell, type NavItem } from "@/ui/pro/ProShell";

export const metadata = { title: { default: "Administration", template: "%s · Admin Sesam-Market" } };

const NAV: Array<NavItem & { perm?: AdminPermission }> = [
  { href: "/admin", label: "Tableau de bord", emoji: "📊", perm: "ANALYTICS_VIEW" },
  { href: "/admin/achats-groupes", label: "Achats groupés", emoji: "👥", perm: "GROUPBUYS_MANAGE" },
  { href: "/admin/commandes", label: "Commandes", emoji: "📦", perm: "ORDERS_MANAGE" },
  { href: "/admin/logistique", label: "Logistique", emoji: "🚚", perm: "LOGISTICS_MANAGE" },
  { href: "/admin/fournisseurs", label: "Fournisseurs", emoji: "🏭", perm: "SUPPLIERS_MANAGE" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", emoji: "🧑‍🤝‍🧑", perm: "USERS_MANAGE" },
  { href: "/admin/analytics", label: "Analytics", emoji: "📈", perm: "ANALYTICS_VIEW" },
  { href: "/admin/audit", label: "Journal d'audit", emoji: "🧾", perm: "AUDIT_VIEW" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["ADMIN"], "/admin");
  const nav = NAV.filter((n) => !n.perm || hasPermission(user, n.perm));
  return (
    <ProShell title="Back-office" user={`${user.firstName} ${user.lastName ?? ""}`} nav={nav}>
      {children}
    </ProShell>
  );
}
