import type { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/session";
import { listUsers } from "@/application/admin.service";
import { hasPermission, ADMIN_PERMISSION_LABELS } from "@/domain/permissions";
import { maskPhone } from "@/domain/payment";
import { formatShortDate } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { CommandButton } from "@/ui/pro/Command";
import { H1, Table } from "@/ui/pro/ProShell";
import { PermissionsEditor } from "./PermissionsEditor";

export const metadata = { title: "Utilisateurs" };

const ROLES: Record<UserRole, string> = { HOUSEHOLD: "Ménage", MERCHANT: "Commerçant", SUPPLIER: "Fournisseur", PICKUP_POINT: "Point relais", DRIVER: "Livreur", ADMIN: "Admin" };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const me = await requirePermission("USERS_MANAGE");
  const sp = await searchParams;
  const role = sp.role && sp.role in ROLES ? (sp.role as UserRole) : undefined;
  const users = await listUsers({ q: sp.q?.slice(0, 40), role });
  const superAdmin = hasPermission(me, "SUPER_ADMIN");
  return (
    <div>
      <H1>Utilisateurs</H1>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Nom ou téléphone" className="h-10 rounded-lg border border-gris-300 bg-white px-3 text-sm" />
        <select name="role" aria-label="Filtrer par rôle" defaultValue={sp.role ?? ""} className="h-10 rounded-lg border border-gris-300 bg-white px-3 text-sm">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">Filtrer</button>
      </form>
      <Table head={["Nom", "Téléphone", "Rôle", "Commune", "Inscrit", "Commandes", "Statut", "Actions"]}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-3 py-2 font-semibold">
              {u.firstName} {u.lastName ?? ""}
              {u.role === "ADMIN" && <span className="block text-xs font-normal text-anthracite-500">{u.adminPermissions.map((p) => ADMIN_PERMISSION_LABELS[p]).join(", ")}</span>}
            </td>
            <td className="px-3 py-2 tabular">{maskPhone(u.phone)}</td>
            <td className="px-3 py-2">{ROLES[u.role]}</td>
            <td className="px-3 py-2">{u.commune}</td>
            <td className="px-3 py-2">{formatShortDate(u.createdAt)}</td>
            <td className="px-3 py-2 tabular">{u._count.orders}</td>
            <td className="px-3 py-2">
              <Badge tone={u.status === "ACTIVE" ? "economie" : "alerte"}>{u.status === "ACTIVE" ? "Actif" : "Suspendu"}</Badge>
            </td>
            <td className="px-3 py-2">
              {u.id !== me.id && (
                <div className="flex flex-wrap gap-1">
                  {u.status === "ACTIVE" ? (
                    <CommandButton space="admin" variant="outline" body={{ type: "user.status", userId: u.id, status: "SUSPENDED" }} confirm="Suspendre ce compte ? Ses sessions seront fermées." success="Compte suspendu">
                      Suspendre
                    </CommandButton>
                  ) : (
                    <CommandButton space="admin" body={{ type: "user.status", userId: u.id, status: "ACTIVE" }} success="Compte réactivé">
                      Réactiver
                    </CommandButton>
                  )}
                  {superAdmin && u.role === "ADMIN" && <PermissionsEditor userId={u.id} current={u.adminPermissions} />}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
