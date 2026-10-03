import { requireRole } from "@/lib/session";
import { supplierDashboard } from "@/application/supplier.service";
import { formatFcfa } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { CommandButton } from "@/ui/pro/Command";
import { H1, Table } from "@/ui/pro/ProShell";

export const metadata = { title: "Bons de commande" };
const S: Record<string, string> = { SENT: "À confirmer", CONFIRMED: "Confirmé", SHIPPED: "Expédié", RECEIVED: "Réceptionné", PARTIALLY_RECEIVED: "Partiellement reçu", CANCELLED: "Annulé", DRAFT: "Brouillon" };

export default async function SupplierOrders() {
  const user = await requireRole(["SUPPLIER"]);
  const d = await supplierDashboard(user.id);
  return (
    <div>
      <H1>Bons de commande</H1>
      <Table head={["N°", "Produit", "Quantité", "Montant", "Attendu le", "Statut", "Paiement", "Action"]} empty={d.purchaseOrders.length === 0}>
        {d.purchaseOrders.map((po) => (
          <tr key={po.id}>
            <td className="px-3 py-2 font-semibold">{po.number}</td>
            <td className="px-3 py-2">{po.items[0]?.product.name}</td>
            <td className="px-3 py-2">
              {po.items[0]?.units} × {po.items[0]?.supplierUnitLabel}
            </td>
            <td className="px-3 py-2 tabular">{formatFcfa(po.totalAmount)}</td>
            <td className="px-3 py-2">{formatDate(po.expectedAt)}</td>
            <td className="px-3 py-2">
              <Badge tone={po.status === "SENT" ? "accent" : po.status === "RECEIVED" ? "economie" : "neutral"}>{S[po.status]}</Badge>
            </td>
            <td className="px-3 py-2">{po.paidToSupplierAt ? "Payé" : po.status === "RECEIVED" ? "En attente" : "—"}</td>
            <td className="px-3 py-2">
              {po.status === "SENT" && (
                <CommandButton space="supplier" body={{ type: "po.confirm", poId: po.id }} success="Bon de commande confirmé" confirm={`Confirmer la livraison de ${po.items[0]?.units} × ${po.items[0]?.supplierUnitLabel} avant le ${formatDate(po.expectedAt)} ?`}>
                  Confirmer
                </CommandButton>
              )}
              {po.status === "CONFIRMED" && (
                <CommandButton space="supplier" variant="secondary" body={{ type: "po.ship", poId: po.id }} success="Expédition signalée">
                  Marquer expédié
                </CommandButton>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
