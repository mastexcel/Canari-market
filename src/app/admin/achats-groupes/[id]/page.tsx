import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { assessGroupBuy, consolidatedDemand } from "@/application/group-buy.service";
import { getRfqWithRanking } from "@/application/procurement.service";
import { lotLedger } from "@/application/inventory.service";
import { toGroupBuyState } from "@/application/pricing.service";
import { computeProgress, describeFailurePolicy } from "@/domain/group-buy";
import { formatBps, formatFcfa } from "@/domain/money";
import { formatQuantity, formatUnits } from "@/domain/units";
import { formatDate, formatDateTime } from "@/domain/dates";
import { Alert } from "@/ui/Alert";
import { Badge } from "@/ui/Badge";
import { GroupProgress } from "@/ui/ProgressBar";
import { CommandButton } from "@/ui/pro/Command";
import { H1, StatCard, Table } from "@/ui/pro/ProShell";
import { GB_STATUS } from "@/ui/pro/labels";
import { AdjustForm, AwardForm, FractionationForm, PublishPanel, ReceiveForm, RfqForm } from "./forms";

const PO_STATUS: Record<string, string> = { DRAFT: "Brouillon", SENT: "Envoyé", CONFIRMED: "Confirmé", SHIPPED: "Expédié", RECEIVED: "Réceptionné", PARTIALLY_RECEIVED: "Partiellement reçu", CANCELLED: "Annulé" };

export default async function AdminGroupBuy({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("GROUPBUYS_MANAGE");
  const { id } = await params;
  const gb = await prisma.groupBuy.findUnique({
    where: { id },
    include: { tiers: { orderBy: { minUnits: "asc" } }, portions: { orderBy: { quantityBase: "asc" } }, product: true, community: true, rfqs: { orderBy: { createdAt: "desc" } }, purchaseOrders: { include: { supplier: true, items: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!gb) notFound();
  const [assessment, consolidated, ledger] = await Promise.all([assessGroupBuy(id), consolidatedDemand(id), lotLedger(id)]);
  const rankings = await Promise.all(gb.rfqs.map((r) => getRfqWithRanking(r.id)));
  const p = computeProgress(toGroupBuyState(gb));
  const unit = gb.product.baseUnit;
  const q = (base: number) => formatQuantity(base, unit);
  const e = consolidated.economics;
  const canProcure = ["CLOSED_SUCCESS", "CLOSED_FAILED"].includes(gb.status) && consolidated.demand.totalBase > 0;
  const openRfq = gb.rfqs.some((r) => r.status === "OPEN");
  // Après publication, l'ancienneté du relevé n'a plus d'effet (prix figé et daté pour le client).
  const visibleWarnings = assessment.warnings.filter((w) => gb.status === "DRAFT" || w.code !== "STALE_REFERENCE");
  const hasPo = gb.purchaseOrders.some((po) => po.status !== "CANCELLED");

  return (
    <div className="space-y-6">
      <H1
        action={
          <div className="flex flex-wrap gap-2">
            {gb.status === "OPEN" && (
              <>
                <CommandButton space="admin" body={{ type: "groupbuy.close", id, force: "success" }} confirm="Clôturer maintenant au palier atteint ? Les différences de prix seront remboursées automatiquement." success="Achat clôturé">
                  Clôturer (succès)
                </CommandButton>
                <CommandButton space="admin" variant="danger" body={{ type: "groupbuy.close", id, force: "cancel" }} confirm="Annuler l'achat groupé ? Tous les participants seront remboursés intégralement." success="Achat annulé">
                  Annuler
                </CommandButton>
              </>
            )}
            <Link href={`/achats-groupes/${gb.slug}`} className="rounded-lg border border-gris-300 px-3 py-1.5 text-sm font-semibold">
              Voir côté ménage
            </Link>
          </div>
        }
      >
        {gb.product.emoji} {gb.title} <Badge tone={GB_STATUS[gb.status].tone}>{GB_STATUS[gb.status].label}</Badge>
      </H1>

      {gb.status === "DRAFT" && <PublishPanel id={id} warnings={assessment.warnings} requiresAck={assessment.requiresAcknowledgement} />}
      {gb.deficitAcknowledged && <Alert tone="warning" title="Publiée malgré un déficit structurel">Motif : {gb.deficitReason}</Alert>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Engagé" value={`${formatUnits(p.committedUnits)} / ${gb.targetUnits}`} hint={`${Math.floor(p.percentOfTarget)} % de l'objectif · ${gb.participantCount} participants`} />
        <StatCard label="Prix courant / final" value={formatFcfa(gb.finalUnitPrice ?? p.payableUnitPrice)} hint={`Référence ${formatFcfa(gb.referenceUnitPrice)} (${formatDate(gb.referenceObservedAt)})`} />
        <StatCard label="Clôture" value={formatDate(gb.closesAt)} hint={`Livraison prévue ${formatDate(gb.expectedDeliveryAt)}`} />
        <StatCard label="Règle si échec" value={gb.failurePolicy === "EXTEND" ? "Prolongation" : gb.failurePolicy === "REFUND" ? "Remboursement" : gb.failurePolicy === "ALTERNATIVE_PRICE" ? "Prix alternatif" : "Avoir (si accord)"} hint={describeFailurePolicy(gb.failurePolicy, gb).slice(0, 80) + "…"} />
      </section>
      <GroupProgress percent={p.percentOfTarget} label="Progression" />

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Demande consolidée</h2>
          <Table head={["Portion", "Portions", "Volume", "Type"]} empty={consolidated.demand.byPortion.length === 0}>
            {consolidated.demand.byPortion.map((l) => (
              <tr key={l.portionBase}>
                <td className="px-3 py-2">{q(l.portionBase)}</td>
                <td className="px-3 py-2 tabular">{l.portions}</td>
                <td className="px-3 py-2 tabular">{q(l.totalBase)}</td>
                <td className="px-3 py-2">{l.isFullUnit ? "Unité entière" : "À fractionner"}</td>
              </tr>
            ))}
          </Table>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Volume total" value={q(consolidated.demand.totalBase)} hint={`${formatUnits(consolidated.demand.exactSupplierUnits, 2)} ${gb.supplierUnitLabel.toLowerCase()} exacts`} />
            <StatCard tone="brand" label="À commander au fournisseur" value={`${consolidated.demand.supplierUnitsToOrder} × ${gb.supplierUnitLabel}`} hint={`dont pertes prévues ${q(consolidated.demand.lossAllowanceBase)}`} />
            <StatCard label="Plan de fractionnement" value={`${consolidated.plan.unitsToOpen} unités à ouvrir`} hint={`${consolidated.plan.bagsNeeded} sachets · ${consolidated.plan.fullUnitsShippedAsIs} unités remises entières`} />
            <StatCard label="Commandes concernées" value={String(consolidated.ordersCount)} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold">Économie unitaire</h2>
          <div className="rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
            <p className="mb-2 font-semibold">Réel (demande confirmée, {formatUnits(e.units, 1)} unités)</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ["Chiffre d'affaires", e.revenue],
                ["Coût fournisseur", -e.supplierCost],
                ["Transport amont", -e.inboundTransport],
                ["Pertes", -e.lossCost],
                ["Marge brute", e.grossMargin],
                ["Stockage", -e.storage],
                ["Fractionnement", -e.fractionation],
                ["Emballage", -e.packaging],
                ["Frais de paiement", -e.paymentFees],
                ["Livraison (subvention)", -e.delivery],
                ["Promotions", -e.promotions],
              ].map(([l, v]) => (
                <div key={l as string} className="contents">
                  <dt className={l === "Marge brute" ? "font-bold" : "text-anthracite-600"}>{l}</dt>
                  <dd className={`text-right tabular ${l === "Marge brute" ? "font-bold" : ""}`}>{formatFcfa(v as number)}</dd>
                </div>
              ))}
              <dt className="border-t border-gris-200 pt-1 font-extrabold">Marge nette estimée</dt>
              <dd className={`border-t border-gris-200 pt-1 text-right font-extrabold tabular ${e.netMargin < 0 ? "text-alerte-700" : "text-economie-700"}`}>
                {formatFcfa(e.netMargin)} ({formatBps(e.netMarginBps)})
              </dd>
            </dl>
          </div>
          <Table head={["Palier", "Prix client", "Marge brute", "Marge nette", "Nette %"]}>
            {assessment.scenarios.map(({ tier, economics: s }) => (
              <tr key={tier.minUnits}>
                <td className="px-3 py-2 tabular">{tier.minUnits}</td>
                <td className="px-3 py-2 tabular">{formatFcfa(tier.unitPrice)}</td>
                <td className="px-3 py-2 tabular">{formatFcfa(s.grossMargin)}</td>
                <td className={`px-3 py-2 tabular ${s.netMargin < 0 ? "font-bold text-alerte-700" : ""}`}>{formatFcfa(s.netMargin)}</td>
                <td className="px-3 py-2 tabular">{formatBps(s.netMarginBps)}</td>
              </tr>
            ))}
          </Table>
          {visibleWarnings.length > 0 && (
            <ul className="space-y-1">
              {visibleWarnings.map((w, i) => (
                <li key={i}>
                  <Alert tone={w.severity === "blocking" ? "error" : "warning"}>{w.message}</Alert>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Approvisionnement</h2>
        {canProcure && !openRfq && !hasPo && <RfqForm id={id} unitLabel={gb.supplierUnitLabel} units={consolidated.demand.supplierUnitsToOrder} />}
        {gb.status === "OPEN" && <p className="text-sm text-anthracite-600">La demande de cotation s&apos;ouvre après la clôture (les quantités sont alors définitives).</p>}
        {rankings.map(({ rfq, ranked, requiredUnits }) => (
          <div key={rfq.id} className="space-y-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">
                {rfq.number} · {requiredUnits} × {rfq.supplierUnitLabel} · {rfq.quality}
              </p>
              <Badge tone={rfq.status === "AWARDED" ? "economie" : "accent"}>{rfq.status === "AWARDED" ? "Attribuée" : rfq.status === "OPEN" ? "Ouverte" : rfq.status}</Badge>
            </div>
            <p className="text-xs text-anthracite-600">
              Réponses jusqu&apos;au {formatDateTime(rfq.closesAt)} · livraison souhaitée le {formatDate(rfq.neededBy)} à {rfq.destination}. Classement multicritère : prix 40 %, qualité 20 %, fiabilité 15 %, délai 15 %, capacité 10 %. La décision reste humaine.
            </p>
            {rfq.awardJustification && <p className="text-sm">Justification : {rfq.awardJustification}</p>}
            <Table head={["Rang", "Fournisseur", "Prix/unité", "Capacité", "Délai", "Score", "Alertes"]} empty={ranked.length === 0}>
              {ranked.map((o) => (
                <tr key={o.responseId} className={o.rank === 1 ? "bg-economie-50" : ""}>
                  <td className="px-3 py-2 font-bold">{o.rank}</td>
                  <td className="px-3 py-2">{o.supplierName}</td>
                  <td className="px-3 py-2 tabular">{formatFcfa(o.unitPrice)}</td>
                  <td className="px-3 py-2 tabular">{o.unitsOffered}</td>
                  <td className="px-3 py-2 tabular">{o.leadTimeDays} j</td>
                  <td className="px-3 py-2 tabular font-semibold">{o.total}</td>
                  <td className="px-3 py-2 text-xs text-alerte-700">{o.flags.join(" · ") || "—"}</td>
                </tr>
              ))}
            </Table>
            {rfq.status === "OPEN" && ranked.length > 0 && <AwardForm rfqId={rfq.id} offers={ranked.map((o) => ({ id: o.responseId, label: `#${o.rank} ${o.supplierName} : ${formatFcfa(o.unitPrice)}`, eligible: o.eligible }))} bestId={ranked[0].responseId} />}
          </div>
        ))}
        {gb.purchaseOrders.map((po) => (
          <div key={po.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
            <div>
              <p className="font-bold">
                Bon de commande {po.number} · {po.supplier.businessName}
              </p>
              <p className="text-sm text-anthracite-600">
                {po.items[0]?.units} × {po.items[0]?.supplierUnitLabel} · {formatFcfa(po.totalAmount)} · attendu le {formatDate(po.expectedAt)} · <strong>{PO_STATUS[po.status]}</strong>
                {po.paidToSupplierAt ? " · fournisseur payé" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {["CONFIRMED", "SHIPPED", "PARTIALLY_RECEIVED"].includes(po.status) && <ReceiveForm poId={po.id} expectedUnits={(po.items[0]?.units ?? 0) - (po.items[0]?.receivedUnits ?? 0)} />}
              {po.status === "RECEIVED" && !po.paidToSupplierAt && (
                <CommandButton space="admin" body={{ type: "po.paid", poId: po.id }} confirm={`Confirmer le règlement de ${formatFcfa(po.totalAmount)} au fournisseur ?`} success="Règlement enregistré" variant="secondary">
                  Marquer payé
                </CommandButton>
              )}
            </div>
          </div>
        ))}
      </section>

      {ledger.ledger.purchasedBase > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Lot & fractionnement</h2>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Acheté (reçu)" value={q(ledger.ledger.purchasedBase)} />
            <StatCard label="Réservé (vendu)" value={q(ledger.ledger.reservedBase)} />
            <StatCard label="Préparé" value={q(ledger.ledger.preparedBase)} hint={`Reste à préparer ${q(ledger.ledger.toPrepareBase)}`} />
            <StatCard label="Livré" value={q(ledger.ledger.dispatchedBase)} hint={`Reste à livrer ${q(ledger.ledger.toDispatchBase)}`} />
            <StatCard tone={ledger.ledger.lossRateBps > gb.lossRateBps ? "alerte" : undefined} label="Pertes" value={q(ledger.ledger.lossBase)} hint={`${formatBps(ledger.ledger.lossRateBps, 2)} (prévu ${formatBps(gb.lossRateBps, 2)})`} />
            <StatCard tone={ledger.ledger.shortage ? "alerte" : "economie"} label={ledger.ledger.shortage ? "Manque" : "Excédent (vente en stock)"} value={q(Math.abs(ledger.ledger.surplusBase))} hint={`Vrac restant ${q(ledger.ledger.bulkRemainingBase)} · écarts ${q(ledger.ledger.adjustmentBase)}`} />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {ledger.ledger.toPrepareBase > 0 && <FractionationForm groupBuyId={id} portions={gb.portions.map((x) => ({ label: x.label, base: x.quantityBase }))} />}
            <AdjustForm groupBuyId={id} />
          </div>
          <Table head={["Date", "Mouvement", "Quantité", "Détail"]}>
            {ledger.movements.slice(-15).reverse().map((m) => (
              <tr key={m.id}>
                <td className="px-3 py-2">{formatDateTime(m.createdAt)}</td>
                <td className="px-3 py-2">{m.type}</td>
                <td className="px-3 py-2 tabular">{q(m.quantityBase)}</td>
                <td className="px-3 py-2 text-xs text-anthracite-600">{m.portionCount ? `${m.portionCount} × ${q(m.portionBase!)}` : ""} {m.reference ?? ""} {m.note ?? ""}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </div>
  );
}
