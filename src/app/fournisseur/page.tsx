import Link from "next/link";
import { requireRole } from "@/lib/session";
import { supplierDashboard } from "@/application/supplier.service";
import { formatFcfa } from "@/domain/money";
import { formatQuantity } from "@/domain/units";
import { formatDateTime } from "@/domain/dates";
import { Alert } from "@/ui/Alert";
import { Badge } from "@/ui/Badge";
import { H1, StatCard, Table } from "@/ui/pro/ProShell";

export default async function SupplierHome() {
  const user = await requireRole(["SUPPLIER"]);
  const d = await supplierDashboard(user.id);
  const s = d.supplier;
  return (
    <div className="space-y-6">
      <H1>{s.businessName}</H1>
      {s.verificationStatus !== "VERIFIED" && (
        <Alert tone="warning" title="Dossier KYB en cours de vérification">
          Vous pourrez répondre aux demandes de cotation une fois votre dossier (RCCM, DFE, pièce d&apos;identité du gérant) validé par CANARI.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="bordeaux" label="Chiffre d'affaires CANARI" value={formatFcfa(d.stats.revenue)} hint="Bons de commande réceptionnés" />
        <StatCard label="Paiements reçus" value={formatFcfa(d.stats.paid)} hint={`En attente : ${formatFcfa(d.stats.pendingPayment)}`} />
        <StatCard label="À confirmer" value={String(d.stats.ordersToConfirm)} hint="Bons de commande" />
        <StatCard label="Performance" value={`${Math.round(s.onTimeRateBps / 100)} % à l'heure`} hint={`Qualité ${s.qualityScore}/100 · fiabilité ${s.reliabilityScore}/100`} />
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Demandes de cotation ouvertes</h2>
        <Table head={["RFQ", "Produit", "Quantité", "Clôture", "Votre offre", ""]} empty={d.openRfqs.length === 0}>
          {d.openRfqs.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 font-semibold">{r.number}</td>
              <td className="px-3 py-2">
                {r.product.emoji} {r.product.name}
              </td>
              <td className="px-3 py-2">
                {formatQuantity(r.quantityBase, r.product.baseUnit)} ({Math.ceil(r.quantityBase / r.supplierUnitQuantityBase)} × {r.supplierUnitLabel})
              </td>
              <td className="px-3 py-2">{formatDateTime(r.closesAt)}</td>
              <td className="px-3 py-2">{r.responses[0] ? <Badge tone="economie">Envoyée</Badge> : <Badge tone="canari">À faire</Badge>}</td>
              <td className="px-3 py-2 text-right">
                <Link href={`/fournisseur/rfq/${r.id}`} className="font-semibold text-bordeaux-700 underline">
                  {r.responses[0] ? "Modifier" : "Répondre"}
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
