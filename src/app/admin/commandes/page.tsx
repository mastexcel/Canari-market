import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { requirePermission } from "@/lib/session";
import { listOrdersAdmin } from "@/application/admin.service";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/domain/order-status";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { H1, Table } from "@/ui/pro/ProShell";

export const metadata = { title: "Commandes" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string }> }) {
  await requirePermission("ORDERS_MANAGE");
  const sp = await searchParams;
  const status = ORDER_STATUSES.includes(sp.statut as OrderStatus) ? (sp.statut as OrderStatus) : undefined;
  const orders = await listOrdersAdmin({ status, q: sp.q?.slice(0, 40) });
  return (
    <div>
      <H1>Commandes</H1>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="N° de commande ou prénom" className="h-10 rounded-lg border border-gris-300 bg-white px-3 text-sm" />
        <select name="statut" defaultValue={sp.statut ?? ""} className="h-10 rounded-lg border border-gris-300 bg-white px-3 text-sm">
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-lg bg-bordeaux-600 px-4 text-sm font-semibold text-white">Filtrer</button>
      </form>
      <Table head={["N°", "Client", "Date", "Statut", "Retrait / livraison", "Total", "Économie"]} empty={orders.length === 0}>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/commandes/${o.id}`} className="font-semibold text-bordeaux-700 underline">
                {o.number}
              </Link>
            </td>
            <td className="px-3 py-2">
              {o.user.firstName} {o.user.lastName ?? ""} <span className="text-xs text-anthracite-500">({o.user.commune})</span>
            </td>
            <td className="px-3 py-2">{formatDateTime(o.createdAt)}</td>
            <td className="px-3 py-2">
              <Badge>{ORDER_STATUS_LABELS[o.status]}</Badge>
            </td>
            <td className="px-3 py-2">{o.pickupPoint?.name ?? "Domicile"}</td>
            <td className="px-3 py-2 tabular">{formatFcfa(o.total)}</td>
            <td className="px-3 py-2 tabular text-economie-700">{formatFcfa(o.savingsTotal)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
