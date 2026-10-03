/**
 * SupplierService : portail fournisseur (profil, KYB, produits, RFQ, bons de
 * commande, paiements, performance).
 */
import { prisma, inTransaction, type Db } from "@/infrastructure/db";
import { DomainError } from "@/domain/errors";
import { audit } from "./audit.service";

export async function supplierForUser(userId: string, db: Db = prisma) {
  const s = await db.supplier.findUnique({ where: { userId }, include: { verifications: { orderBy: { createdAt: "desc" } } } });
  if (!s) throw new DomainError("FORBIDDEN", "Profil fournisseur introuvable.");
  return s;
}

export async function supplierDashboard(userId: string, db: Db = prisma, now = new Date()) {
  const s = await supplierForUser(userId, db);
  const [openRfqs, pos, products] = await Promise.all([
    db.rFQ.findMany({
      where: { status: "OPEN", closesAt: { gt: now }, product: { supplierProducts: { some: { supplierId: s.id, isActive: true } } } },
      include: { product: true, responses: { where: { supplierId: s.id } } },
      orderBy: { closesAt: "asc" },
    }),
    db.purchaseOrder.findMany({ where: { supplierId: s.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.supplierProduct.findMany({ where: { supplierId: s.id }, include: { product: true, priceTiers: { orderBy: { minUnits: "asc" } } } }),
  ]);
  const delivered = pos.filter((p) => p.status === "RECEIVED");
  return {
    supplier: s,
    openRfqs,
    purchaseOrders: pos,
    products,
    stats: {
      revenue: delivered.reduce((s2, p) => s2 + p.totalAmount, 0),
      pendingPayment: delivered.filter((p) => !p.paidToSupplierAt).reduce((s2, p) => s2 + p.totalAmount, 0),
      paid: delivered.filter((p) => p.paidToSupplierAt).reduce((s2, p) => s2 + p.totalAmount, 0),
      ordersToConfirm: pos.filter((p) => p.status === "SENT").length,
      openRfqs: openRfqs.filter((r) => r.responses.length === 0).length,
    },
  };
}

export async function supplierRfq(userId: string, rfqId: string, db: Db = prisma) {
  const s = await supplierForUser(userId, db);
  const rfq = await db.rFQ.findFirst({
    where: { id: rfqId, product: { supplierProducts: { some: { supplierId: s.id } } } },
    include: { product: true, responses: { where: { supplierId: s.id } } },
  });
  if (!rfq) throw new DomainError("NOT_FOUND", "Demande de cotation introuvable.");
  // Un fournisseur ne voit jamais les offres concurrentes.
  return { rfq, myResponse: rfq.responses[0] ?? null, supplier: s };
}

/** Met à jour la capacité et les prix dégressifs d'un produit fournisseur (journalisé). */
export async function updateSupplierProduct(
  userId: string,
  supplierProductId: string,
  input: { capacityUnitsPerWeek: number; leadTimeDays: number; tiers: Array<{ minUnits: number; unitPrice: number }> },
  db: Db = prisma,
) {
  const s = await supplierForUser(userId, db);
  const sp = await db.supplierProduct.findFirst({ where: { id: supplierProductId, supplierId: s.id }, include: { priceTiers: true } });
  if (!sp) throw new DomainError("NOT_FOUND", "Produit introuvable.");
  const { normalizeTiers } = await import("@/domain/pricing");
  normalizeTiers(input.tiers);
  await inTransaction(db, async (tx) => {
    await tx.priceTier.deleteMany({ where: { supplierProductId } });
    await tx.priceTier.createMany({ data: input.tiers.map((t) => ({ ...t, supplierProductId })) });
    await tx.supplierProduct.update({ where: { id: supplierProductId }, data: { capacityUnitsPerWeek: input.capacityUnitsPerWeek, leadTimeDays: input.leadTimeDays } });
  });
  await audit({ actorId: userId, action: "price.supplier.update", entityType: "SupplierProduct", entityId: supplierProductId, before: sp.priceTiers, after: input }, db);
}
