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
import { illustration, productImage } from "@/infrastructure/assets";
import { ProductTile } from "@/ui/ProductTile";

export const metadata = { title: "Mes commandes" };

const tone = (s: string) => (s === "DELIVERED" ? "economie" : s === "CANCELLED" || s === "REFUNDED" ? "neutral" : s === "PENDING_PAYMENT" ? "alerte" : s === "READY_FOR_PICKUP" || s === "OUT_FOR_DELIVERY" ? "accent" : "brand");

export default async function OrdersPage() {
  const user = await requireUser("/commandes");
  const orders = await listOrders(user.id);
  return (
    <div>
      <PageHeader title="Mes commandes" />
      {orders.length === 0 ? (
        <EmptyState title="Pas encore de commande" emoji="📦" image={illustration("etats", "aucune-commande")} action={<ButtonLink href="/achats-groupes">Rejoindre un achat groupé</ButtonLink>} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/commandes/${o.id}`} className="block h-full rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-white transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.number}</p>
                    <p className="text-xs text-anthracite-600">{formatDateTime(o.createdAt)}</p>
                  </div>
                  <Badge tone={tone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex shrink-0 gap-1.5">
                    {o.items.slice(0, 2).map((i, k) => (
                      <ProductTile key={k} emoji={i.product.emoji} name={i.product.name} src={productImage(i.product.slug)} size="sm" className="size-14 text-2xl" />
                    ))}
                    {o.items.length > 2 && <span className="grid size-14 place-items-center rounded-2xl bg-sable-100 text-sm font-bold text-anthracite-800">+{o.items.length - 2}</span>}
                  </div>
                  <p className="line-clamp-2 min-w-0 flex-1 text-sm text-anthracite-700">{o.items.map((i) => `${i.quantity}× ${i.label}`).join(", ")}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gris-100 pt-2.5 text-sm">
                  <span className="text-lg font-extrabold text-brand-800 tabular">{formatFcfa(o.total)}</span>
                  {o.savingsTotal > 0 && <span className="rounded-full bg-accent-100 px-2.5 py-0.5 font-bold text-economie-700">Économie {formatFcfa(o.savingsTotal)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
