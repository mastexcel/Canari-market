import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { supplierRfq } from "@/application/supplier.service";
import { DomainError } from "@/domain/errors";
import { formatQuantity } from "@/domain/units";
import { formatDate, formatDateTime } from "@/domain/dates";
import { H1 } from "@/ui/pro/ProShell";
import { RfqResponseForm } from "./RfqResponseForm";

export default async function SupplierRfq({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["SUPPLIER"]);
  const { id } = await params;
  let data;
  try {
    data = await supplierRfq(user.id, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const { rfq, myResponse } = data;
  const units = Math.ceil(rfq.quantityBase / rfq.supplierUnitQuantityBase);
  return (
    <div className="max-w-2xl space-y-4">
      <H1>Demande de cotation {rfq.number}</H1>
      <dl className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        <dt className="text-anthracite-600">Produit</dt>
        <dd className="font-semibold">{rfq.product.name}</dd>
        <dt className="text-anthracite-600">Quantité</dt>
        <dd className="font-semibold">
          {units} × {rfq.supplierUnitLabel} ({formatQuantity(rfq.quantityBase, rfq.product.baseUnit)})
        </dd>
        <dt className="text-anthracite-600">Qualité</dt>
        <dd>{rfq.quality}</dd>
        <dt className="text-anthracite-600">Conditionnement</dt>
        <dd>{rfq.packaging}</dd>
        <dt className="text-anthracite-600">Destination</dt>
        <dd>{rfq.destination}</dd>
        <dt className="text-anthracite-600">Livraison souhaitée</dt>
        <dd>{formatDate(rfq.neededBy)}</dd>
        <dt className="text-anthracite-600">Clôture des offres</dt>
        <dd>{formatDateTime(rfq.closesAt)}</dd>
      </dl>
      <p className="text-xs text-anthracite-600">
        CANARI compare les offres sur le prix, la qualité, la fiabilité, le délai et la capacité. Vous ne voyez jamais les offres concurrentes, et elles ne voient pas la vôtre.
      </p>
      {rfq.status === "OPEN" ? (
        <RfqResponseForm rfqId={rfq.id} units={units} existing={myResponse ? { unitPrice: myResponse.unitPrice, unitsOffered: myResponse.unitsOffered, leadTimeDays: myResponse.leadTimeDays, deliveryLocation: myResponse.deliveryLocation, conditions: myResponse.conditions ?? "", qualityNote: myResponse.qualityNote ?? "" } : null} />
      ) : (
        <p className="font-semibold">Cette demande est close.</p>
      )}
    </div>
  );
}
