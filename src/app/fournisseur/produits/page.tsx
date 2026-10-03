import { requireRole } from "@/lib/session";
import { supplierDashboard } from "@/application/supplier.service";
import { H1 } from "@/ui/pro/ProShell";
import { ProductTierForm } from "./ProductTierForm";

export const metadata = { title: "Produits & tarifs" };

export default async function SupplierProducts() {
  const user = await requireRole(["SUPPLIER"]);
  const d = await supplierDashboard(user.id);
  return (
    <div className="space-y-4">
      <H1>Produits & tarifs dégressifs</H1>
      <p className="text-sm text-anthracite-600">Indiquez votre capacité et vos prix par palier : Sesam-Market s&apos;en sert pour dimensionner les achats groupés. Chaque modification de prix est journalisée.</p>
      {d.products.length === 0 && <p>Aucun produit référencé pour l&apos;instant. Contactez Sesam-Market pour ajouter votre catalogue.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {d.products.map((p) => (
          <ProductTierForm key={p.id} id={p.id} name={`${p.product.emoji} ${p.product.name}`} unitLabel={p.supplierUnitLabel} capacity={p.capacityUnitsPerWeek} lead={p.leadTimeDays} tiers={p.priceTiers.map((t) => ({ minUnits: t.minUnits, unitPrice: t.unitPrice }))} />
        ))}
      </div>
    </div>
  );
}
