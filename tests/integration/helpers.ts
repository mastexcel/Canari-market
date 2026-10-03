import { prisma } from "@/infrastructure/db";
import { hashPassword } from "@/infrastructure/auth/password";
import { rateLimiter } from "@/infrastructure/rate-limit";

/** Vide toutes les tables de la base de test. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  rateLimiter.reset();
}

const DAY = 86_400_000;
let seq = 0;
export const phoneFor = (n: number) => `07${String(10_000_000 + n).slice(-8)}`;

export async function makeUser(role: "HOUSEHOLD" | "SUPPLIER" | "ADMIN" | "DRIVER" | "PICKUP_POINT" = "HOUSEHOLD", extra: Record<string, unknown> = {}) {
  seq++;
  return prisma.user.create({
    data: {
      phone: `+225${phoneFor(seq + 500)}`,
      passwordHash: await hashPassword("motdepasse1"),
      firstName: `${role.toLowerCase()}${seq}`,
      role,
      referralCode: `T${seq}${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      commune: "Cocody",
      quartier: "Angré",
      adminPermissions: role === "ADMIN" ? ["SUPER_ADMIN"] : [],
      ...extra,
    },
  });
}

/** Socle : catalogue, entrepôt, point relais, zone, fournisseur vérifié, achat groupé ouvert. */
export async function baseFixture(opts: { failurePolicy?: "REFUND" | "EXTEND" | "ALTERNATIVE_PRICE" | "CREDIT_WITH_CONSENT"; maxUnits?: number } = {}) {
  const now = new Date();
  const category = await prisma.category.create({ data: { slug: "alimentation", name: "Alimentation", emoji: "🍚" } });
  const product = await prisma.product.create({
    data: { slug: "riz-parfume", name: "Riz parfumé", description: "Riz long grain", categoryId: category.id, baseUnit: "GRAM", emoji: "🍚" },
  });
  const variant = await prisma.productVariant.create({
    data: { productId: product.id, sku: "RIZ-5", name: "Sac 5 kg", quantityBase: 5_000, weightGrams: 5_000, canariPrice: 2_600 },
  });
  await prisma.referencePrice.create({
    data: { variantId: variant.id, price: 3_000, source: "MARKET_SURVEY", sourceLabel: "Relevé test", method: "Médiane", observedAt: new Date(now.getTime() - 2 * DAY) },
  });
  const warehouse = await prisma.warehouse.create({ data: { name: "Entrepôt Yopougon", commune: "Yopougon", address: "Zone industrielle" } });
  const pickupManager = await makeUser("PICKUP_POINT");
  const pickupPoint = await prisma.pickupPoint.create({
    data: { code: "PR-ANG", name: "Point Angré", commune: "Cocody", quartier: "Angré", address: "Carrefour", openingHours: "8h-19h", managerUserId: pickupManager.id, customerFee: 200 },
  });
  const zone = await prisma.deliveryZone.create({ data: { commune: "Cocody", baseFee: 1_000, distanceKm: 12, perKmFee: 25, quartiers: ["Angré"] } });
  const supplierUser = await makeUser("SUPPLIER");
  const supplier = await prisma.supplier.create({
    data: { userId: supplierUser.id, businessName: "Riz du Nord SARL", type: "WHOLESALER", commune: "Treichville", contactPhone: "+2250707000000", verificationStatus: "VERIFIED", qualityScore: 85, reliabilityScore: 88 },
  });
  const supplierProduct = await prisma.supplierProduct.create({
    data: { supplierId: supplier.id, productId: product.id, supplierUnitLabel: "Sac 50 kg", supplierUnitQuantityBase: 50_000, capacityUnitsPerWeek: 500, leadTimeDays: 3, priceTiers: { create: [{ minUnits: 1, unitPrice: 22_000 }] } },
  });
  const admin = await makeUser("ADMIN");
  const groupBuy = await prisma.groupBuy.create({
    data: {
      slug: "riz-50kg",
      title: "Riz parfumé 50 kg",
      description: "Achat groupé de riz",
      productId: product.id,
      supplierProductId: supplierProduct.id,
      status: "OPEN",
      supplierUnitLabel: "Sac 50 kg",
      supplierUnitQuantityBase: 50_000,
      targetUnits: 4,
      maxUnits: opts.maxUnits ?? 6,
      referenceUnitPrice: 27_500,
      referenceSource: "Relevé Sesam-Market",
      referenceMethod: "Médiane de 3 marchés",
      referenceObservedAt: new Date(now.getTime() - 3 * DAY),
      opensAt: new Date(now.getTime() - DAY),
      closesAt: new Date(now.getTime() + 3 * DAY),
      expectedDeliveryAt: new Date(now.getTime() + 6 * DAY),
      failurePolicy: opts.failurePolicy ?? "REFUND",
      alternativeUnitPrice: 26_000,
      supplierUnitCost: 22_000,
      fractionationFeePerPortion: 150,
      expectedAvgPortionBase: 10_000,
      tiers: { create: [{ minUnits: 2, unitPrice: 25_500 }, { minUnits: 4, unitPrice: 24_500 }] },
      portions: { create: [{ label: "5 kg", quantityBase: 5_000 }, { label: "10 kg", quantityBase: 10_000 }, { label: "50 kg", quantityBase: 50_000 }] },
    },
    include: { portions: true },
  });
  await prisma.inventory.create({ data: { warehouseId: warehouse.id, productId: product.id, quantityBase: 100_000 } });
  const portion = (kg: number) => groupBuy.portions.find((p) => p.quantityBase === kg * 1000)!;
  return { category, product, variant, warehouse, pickupPoint, pickupManager, zone, supplier, supplierUser, supplierProduct, admin, groupBuy, portion };
}
