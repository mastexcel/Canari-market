import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/session";
import { getOrderForUser } from "@/application/order.service";
import { DomainError } from "@/domain/errors";
import { ORDER_STATUS_LABELS } from "@/domain/order-status";
import { PAYMENT_STATUS_LABELS } from "@/domain/payment";
import { alternativePriceSupplement } from "@/domain/group-buy";
import { formatFcfa } from "@/domain/money";
import { formatDate, formatDateTime } from "@/domain/dates";
import { Card, PageHeader } from "@/ui/Card";
import { Alert } from "@/ui/Alert";
import { Badge } from "@/ui/Badge";
import { Timeline } from "@/ui/Timeline";
import { BackLink } from "@/ui/shop/BackLink";
import { OrderActions, AlternativeDecision, ReviewForm } from "./OrderActions";

export const metadata = { title: "Suivi de commande" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ confirmee?: string }> }) {
  const { id } = await params;
  const { confirmee } = await searchParams;
  const user = await requireUser(`/commandes/${id}`);
  let order;
  try {
    order = await getOrderForUser(user.id, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const showCode = ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "READY"].includes(order.status);
  const qr = showCode ? await QRCode.toString(`SESAM:${order.number}:${order.pickupCode}`, { type: "svg", margin: 1, color: { dark: "#17241c", light: "#ffffff" } }) : null;
  const refunded = order.refunds.reduce((s, r) => s + r.amount, 0);
  const awaiting = order.items.filter((i) => i.participant?.status === "AWAITING_DECISION" && i.groupBuy?.alternativeUnitPrice);
  const cancellable = ["PENDING_PAYMENT", "GROUP_PENDING", "RECEIVED_WAREHOUSE"].includes(order.status) && order.items.every((i) => !i.groupBuy || i.groupBuy.status === "OPEN");

  return (
    <div className="space-y-4">
      <PageHeader title={order.number} subtitle={`Passée le ${formatDateTime(order.createdAt)}`} back={<BackLink href="/commandes" />} />

      {confirmee && order.status !== "PENDING_PAYMENT" && (
        <div className="capsule-lagune rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)]">
          <p className="text-2xl">🎉</p>
          <p className="text-lg font-extrabold">Commande confirmée !</p>
          {order.savingsTotal > 0 && <p className="mt-1">Vous économisez {formatFcfa(order.savingsTotal)} grâce au groupe.</p>}
          <p className="mt-1 text-sm text-white">Nous vous prévenons à chaque étape.</p>
        </div>
      )}

      <Card className="flex items-center justify-between p-4">
        <span className="text-sm text-anthracite-600">Statut</span>
        <Badge tone="brand">{ORDER_STATUS_LABELS[order.status]}</Badge>
      </Card>

      {awaiting.map((i) => (
        <AlternativeDecision
          key={i.id}
          orderId={order.id}
          itemId={i.id}
          label={i.label}
          supplement={alternativePriceSupplement(i.groupBuy!.alternativeUnitPrice!, i.unitQuantityBase, i.groupBuy!.supplierUnitQuantityBase, i.unitPrice, i.quantity)}
        />
      ))}

      {qr && (
        <Card className="p-4 text-center">
          <p className="font-bold">{order.fulfillmentMode === "PICKUP" ? "Code de retrait" : "Code de livraison"}</p>
          <div className="mx-auto my-3 w-44" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="text-3xl font-extrabold tracking-[0.3em] tabular">{order.pickupCode}</p>
          <p className="mt-1 text-xs text-anthracite-600">Ne communiquez ce code qu&apos;au moment de la remise.</p>
        </Card>
      )}

      <Card className="p-4">
        <h2 className="mb-3 font-bold">Suivi</h2>
        <Timeline steps={order.timeline} />
        {order.expectedReadyAt && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(order.status) && (
          <p className="mt-3 text-sm text-anthracite-600">Disponibilité estimée : {formatDate(order.expectedReadyAt)}</p>
        )}
      </Card>

      <Card className="p-4 text-sm">
        <h2 className="mb-2 font-bold">{order.fulfillmentMode === "PICKUP" ? "Retrait" : "Livraison"}</h2>
        {order.pickupPoint ? (
          <p>
            <strong>{order.pickupPoint.name}</strong>
            <br />
            {order.pickupPoint.address}, {order.pickupPoint.quartier} ({order.pickupPoint.commune})
            {order.pickupPoint.landmark && <><br />Repère : {order.pickupPoint.landmark}</>}
            <br />
            Horaires : {order.pickupPoint.openingHours}
          </p>
        ) : order.address ? (
          <p>
            {order.address.quartier}, {order.address.commune}
            {order.address.landmark && ` — ${order.address.landmark}`}
            {order.slotStart && <><br />Créneau : {formatDateTime(order.slotStart)}</>}
            {order.delivery?.driver && <><br />Livreur : {order.delivery.driver.user.firstName}</>}
          </p>
        ) : null}
      </Card>

      <Card className="divide-y divide-gris-200">
        {order.items.map((i) => (
          <div key={i.id} className="flex items-start justify-between gap-3 p-3 text-sm">
            <span className="flex gap-2">
              <span className="text-xl" aria-hidden>
                {i.product.emoji}
              </span>
              <span>
                <span className="block font-semibold">
                  {i.quantity} × {i.label}
                </span>
                <span className="text-xs text-anthracite-600">{ORDER_STATUS_LABELS[i.status]}</span>
                {i.finalUnitPrice !== null && i.finalUnitPrice < i.unitPrice && (
                  <span className="block text-xs font-semibold text-economie-700">
                    Prix final {formatFcfa(i.finalUnitPrice)} (au lieu de {formatFcfa(i.unitPrice)} payés)
                  </span>
                )}
              </span>
            </span>
            <span className="tabular font-semibold">{formatFcfa(i.lineTotal)}</span>
          </div>
        ))}
      </Card>

      <Card className="space-y-1 p-4 text-sm">
        <Line label="Sous-total" value={order.subtotal} />
        {order.fractionationFees > 0 && <Line label="Fractionnement" value={order.fractionationFees} />}
        <Line label={order.fulfillmentMode === "PICKUP" ? "Retrait" : "Livraison"} value={order.deliveryFee} />
        {order.discountTotal > 0 && <Line label="Remise" value={-order.discountTotal} />}
        {order.creditApplied > 0 && <Line label="Avoir" value={-order.creditApplied} />}
        <div className="flex justify-between border-t border-gris-200 pt-2 text-base font-extrabold">
          <span>Total payé</span>
          <span className="tabular">{formatFcfa(order.total)}</span>
        </div>
        {refunded > 0 && <Line label="Remboursé" value={-refunded} tone="economie" />}
        {order.savingsTotal > 0 && <Line label="Votre économie" value={order.savingsTotal} tone="economie" />}
      </Card>

      {(order.payments.length > 0 || order.refunds.length > 0) && (
        <Card className="p-4 text-sm">
          <h2 className="mb-2 font-bold">Paiements</h2>
          <ul className="space-y-1">
            {order.payments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {p.purpose === "SUPPLEMENT" ? "Supplément" : "Paiement"} · {PAYMENT_STATUS_LABELS[p.status]}
                </span>
                <span className="tabular">{formatFcfa(p.amount)}</span>
              </li>
            ))}
            {order.refunds.map((r) => (
              <li key={r.id} className="flex justify-between text-economie-700">
                <span>Remboursement {r.status === "SUCCEEDED" ? "effectué" : r.status === "PENDING" ? "en cours" : "en échec"} {r.note ? `· ${r.note}` : ""}</span>
                <span className="tabular">{formatFcfa(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {order.status === "PENDING_PAYMENT" && (
        <Alert tone="warning" title="Paiement en attente">
          Votre commande est réservée pendant 1 heure. Finalisez le paiement pour confirmer votre participation.
        </Alert>
      )}
      <OrderActions orderId={order.id} canPay={order.status === "PENDING_PAYMENT"} canCancel={cancellable} />

      {order.status === "DELIVERED" && <ReviewForm orderId={order.id} done={order.reviews.map((r) => r.target)} />}

      <p className="text-center text-sm">
        Un problème ? <Link href={`/support?commande=${order.id}`} className="font-semibold text-brand-700 underline">Contacter le support</Link>
      </p>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: number; tone?: "economie" }) {
  return (
    <div className={`flex justify-between ${tone ? "font-semibold text-economie-700" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value === 0 ? "Gratuit" : formatFcfa(value)}</span>
    </div>
  );
}
