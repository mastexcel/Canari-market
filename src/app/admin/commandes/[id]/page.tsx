import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { getOrderAdmin } from "@/application/admin.service";
import { DomainError } from "@/domain/errors";
import { ORDER_STATUS_LABELS } from "@/domain/order-status";
import { PAYMENT_STATUS_LABELS, maskPhone } from "@/domain/payment";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { CommandButton } from "@/ui/pro/Command";
import { H1, Table } from "@/ui/pro/ProShell";
import { RefundForm } from "./RefundForm";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("ORDERS_MANAGE");
  const { id } = await params;
  let o;
  try {
    o = await getOrderAdmin(id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const refunded = o.refunds.reduce((s, r) => s + r.amount, 0);
  const stockToPrepare = o.items.some((i) => i.kind === "STOCK" && ["RECEIVED_WAREHOUSE", "PACKING"].includes(i.status));
  return (
    <div className="space-y-5">
      <H1 action={stockToPrepare ? <CommandButton space="admin" body={{ type: "order.prepare", orderId: o.id }} success="Articles en stock préparés">Préparer le stock</CommandButton> : undefined}>
        {o.number} <Badge tone="bordeaux">{ORDER_STATUS_LABELS[o.status]}</Badge>
      </H1>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
          <p className="font-bold">Client</p>
          <p>
            {o.user.firstName} {o.user.lastName ?? ""} · {maskPhone(o.user.phone)} · {o.user.commune}
          </p>
          <p className="mt-2 font-bold">{o.fulfillmentMode === "PICKUP" ? "Retrait" : "Livraison"}</p>
          <p>{o.pickupPoint ? `${o.pickupPoint.name} (${o.pickupPoint.commune})` : `${o.address?.quartier}, ${o.address?.commune}`}</p>
          {o.delivery && (
            <p className="text-anthracite-600">
              Statut livraison : {o.delivery.status}
              {o.delivery.driver ? ` · ${o.delivery.driver.user.firstName}` : ""} · tentatives {o.delivery.attempts}
              {o.delivery.failureReason ? ` · incident : ${o.delivery.failureReason}` : ""}
            </p>
          )}
        </div>
        <div className="rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
          <p className="font-bold">Montants</p>
          <p>Sous-total {formatFcfa(o.subtotal)} · fractionnement {formatFcfa(o.fractionationFees)} · livraison {formatFcfa(o.deliveryFee)}</p>
          <p>Remise {formatFcfa(o.discountTotal)} · avoir {formatFcfa(o.creditApplied)}</p>
          <p className="font-bold">Total {formatFcfa(o.total)} · remboursé {formatFcfa(refunded)}</p>
          <p className="text-economie-700">Économie client {formatFcfa(o.savingsTotal)}</p>
        </div>
        <RefundForm orderId={o.id} max={o.total - refunded} />
      </div>
      <Table head={["Article", "Qté", "Prix payé", "Prix final", "Fract.", "Statut", "Achat groupé"]}>
        {o.items.map((i) => (
          <tr key={i.id}>
            <td className="px-3 py-2">{i.label}</td>
            <td className="px-3 py-2 tabular">{i.quantity}</td>
            <td className="px-3 py-2 tabular">{formatFcfa(i.unitPrice)}</td>
            <td className="px-3 py-2 tabular">{i.finalUnitPrice !== null ? formatFcfa(i.finalUnitPrice) : "—"}</td>
            <td className="px-3 py-2 tabular">{formatFcfa(i.fractionationFee)}</td>
            <td className="px-3 py-2">{ORDER_STATUS_LABELS[i.status]}</td>
            <td className="px-3 py-2">{i.groupBuy ? `${i.groupBuy.title} (${i.groupBuy.status})` : "Stock"}</td>
          </tr>
        ))}
      </Table>
      <div className="grid gap-4 lg:grid-cols-2">
        <Table head={["Paiement", "Montant", "Statut", "Événements"]}>
          {o.payments.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2 text-xs">
                {p.provider} · {p.method} {p.operator ?? ""} {p.payerPhoneMasked ?? ""}
              </td>
              <td className="px-3 py-2 tabular">{formatFcfa(p.amount)}</td>
              <td className="px-3 py-2">{PAYMENT_STATUS_LABELS[p.status]}</td>
              <td className="px-3 py-2 text-xs">{p.transactions.map((t) => `${t.type}:${t.status}`).join(", ")}</td>
            </tr>
          ))}
        </Table>
        <Table head={["Date", "Statut", "Note"]}>
          {o.events.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2">{formatDateTime(e.createdAt)}</td>
              <td className="px-3 py-2">{ORDER_STATUS_LABELS[e.status]}</td>
              <td className="px-3 py-2 text-xs">{e.note}</td>
            </tr>
          ))}
        </Table>
      </div>
      {o.refunds.length > 0 && (
        <Table head={["Remboursement", "Montant", "Motif", "Statut"]}>
          {o.refunds.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">{formatDateTime(r.createdAt)}</td>
              <td className="px-3 py-2 tabular">{formatFcfa(r.amount)}</td>
              <td className="px-3 py-2">
                {r.reason} {r.note ? `· ${r.note}` : ""}
              </td>
              <td className="px-3 py-2">{r.status}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
