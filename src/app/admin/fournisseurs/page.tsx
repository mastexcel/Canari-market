import { requirePermission } from "@/lib/session";
import { listSuppliers } from "@/application/admin.service";
import { Badge } from "@/ui/Badge";
import { CommandButton } from "@/ui/pro/Command";
import { H1, Table } from "@/ui/pro/ProShell";

export const metadata = { title: "Fournisseurs" };

const V: Record<string, { label: string; tone: "economie" | "canari" | "alerte" | "neutral" }> = {
  VERIFIED: { label: "Vérifié", tone: "economie" },
  IN_REVIEW: { label: "En revue", tone: "canari" },
  PENDING: { label: "À vérifier", tone: "neutral" },
  REJECTED: { label: "Refusé", tone: "alerte" },
};
const TYPES: Record<string, string> = { PRODUCER: "Producteur", COOPERATIVE: "Coopérative", WHOLESALER: "Grossiste", IMPORTER: "Importateur", DISTRIBUTOR: "Distributeur" };

export default async function Suppliers() {
  await requirePermission("SUPPLIERS_MANAGE");
  const suppliers = await listSuppliers();
  return (
    <div>
      <H1>Fournisseurs</H1>
      <p className="mb-4 text-sm text-anthracite-600">Seuls les fournisseurs vérifiés (KYB : RCCM, DFE, identité du gérant) reçoivent les demandes de cotation. Les documents sont stockés de façon privée.</p>
      <Table head={["Fournisseur", "Type", "Commune", "KYB", "Qualité", "Fiabilité", "Ponctualité", "BC", "Actions"]}>
        {suppliers.map((s) => (
          <tr key={s.id}>
            <td className="px-3 py-2 font-semibold">
              {s.businessName}
              <span className="block text-xs font-normal text-anthracite-500">RCCM {s.registrationNumber ?? "—"} · NCC {s.taxId ?? "—"}</span>
            </td>
            <td className="px-3 py-2">{TYPES[s.type]}</td>
            <td className="px-3 py-2">{s.commune}</td>
            <td className="px-3 py-2">
              <Badge tone={V[s.verificationStatus].tone}>{V[s.verificationStatus].label}</Badge>
              <span className="block text-xs text-anthracite-500">{s.verifications.map((v) => v.documentType).join(", ")}</span>
            </td>
            <td className="px-3 py-2 tabular">{s.qualityScore}</td>
            <td className="px-3 py-2 tabular">{s.reliabilityScore}</td>
            <td className="px-3 py-2 tabular">{Math.round(s.onTimeRateBps / 100)} %</td>
            <td className="px-3 py-2 tabular">{s._count.purchaseOrders}</td>
            <td className="px-3 py-2">
              <div className="flex gap-1">
                {s.verificationStatus !== "VERIFIED" && (
                  <CommandButton space="admin" body={{ type: "supplier.verify", supplierId: s.id, status: "VERIFIED" }} success="Fournisseur vérifié" confirm="Documents KYB contrôlés et conformes ?">
                    Vérifier
                  </CommandButton>
                )}
                {s.verificationStatus !== "REJECTED" && (
                  <CommandButton space="admin" variant="outline" body={{ type: "supplier.verify", supplierId: s.id, status: "REJECTED", notes: "Dossier non conforme" }} success="Dossier refusé" confirm="Refuser ce dossier fournisseur ?">
                    Refuser
                  </CommandButton>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
