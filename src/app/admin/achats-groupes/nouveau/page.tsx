import { requirePermission } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { H1 } from "@/ui/pro/ProShell";
import { NewGroupBuyForm } from "./NewGroupBuyForm";

export const metadata = { title: "Nouvel achat groupé" };

export default async function NewGroupBuyPage() {
  await requirePermission("PRICING_MANAGE");
  const [products, communities] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, brand: true, baseUnit: true, emoji: true, supplierProducts: { where: { isActive: true, supplier: { verificationStatus: "VERIFIED" } }, select: { id: true, supplierUnitLabel: true, supplierUnitQuantityBase: true, supplier: { select: { businessName: true } }, priceTiers: { orderBy: { minUnits: "asc" }, take: 1 } } } },
    }),
    prisma.community.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="max-w-3xl">
      <H1>Nouvel achat groupé</H1>
      <p className="mb-4 text-sm text-anthracite-600">L&apos;achat est créé en brouillon. Son économie unitaire est évaluée à chaque palier avant publication.</p>
      <NewGroupBuyForm
        products={products.map((p) => ({
          id: p.id,
          label: `${p.emoji} ${p.name}${p.brand ? ` (${p.brand})` : ""}`,
          baseUnit: p.baseUnit,
          offers: p.supplierProducts.map((s) => ({ id: s.id, label: `${s.supplier.businessName} (${s.supplierUnitLabel})`, unitLabel: s.supplierUnitLabel, unitBase: s.supplierUnitQuantityBase, cost: s.priceTiers[0]?.unitPrice ?? 0 })),
        }))}
        communities={communities}
      />
    </div>
  );
}
