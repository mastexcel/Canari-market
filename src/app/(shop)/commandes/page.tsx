import Link from "next/link";
import { requireUser } from "@/lib/session";
import { listOrders } from "@/application/order.service";
import { ORDER_STATUS_LABELS } from "@/domain/order-status";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { PageHeader } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { ButtonLink } from "@/ui/Button";

export const metadata = { title: "Mes commandes" };

const tone = (s: string) => (s === "DELIVERED" ? "economie" : s === "CANCELLED" || s === "REFUNDED" ? "neutral" : s === "PENDING_PAYMENT" ? "alerte" : s === "READY_FOR_PICKUP" || s === "OUT_FOR_DELIVERY" ? "accent" : "brand");

export default async function OrdersPage() {
  const user = await requireUser("/commandes");
  const orders = await listOrders(user.id);
  return (
    <div>
      <PageHeader title="Mes commandes" />
      {orders.length === 0 ? (
        <EmptyState title="Pas encore de commande" emoji="📦" action={<ButtonLink href="/achats-groupes">Rejoindre un achat groupé</ButtonLink>} />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/commandes/${o.id}`} className="block rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.number}</p>
                    <p className="text-xs text-anthracite-600">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <Badge tone={tone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-anthracite-700">{o.items.map((i) => `${i.quantity}× ${i.label}`).join(", ")}</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="tabular font-bold">{formatFcfa(o.total)}</span>
                  {o.savingsTotal > 0 && <span className="font-semibold text-economie-700">Économie {formatFcfa(o.savingsTotal)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
