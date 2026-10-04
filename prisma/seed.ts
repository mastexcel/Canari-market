/**
 * Seed de démonstration Sesam-Market (Abidjan).
 * Toutes les commandes passent par les VRAIS services (panier → commande →
 * paiement → clôture → RFQ → bon de commande → réception → fractionnement →
 * livraison) : les compteurs, stocks, remboursements et économies sont donc
 * cohérents, comme en production.
 *
 * Usage : npm run db:seed   (refusé en production)
 */
import type { FulfillmentMode, Prisma } from "@prisma/client";
import { prisma } from "../src/infrastructure/db";
import { hashPassword } from "../src/infrastructure/auth/password";
import { addToCart } from "../src/application/cart.service";
import { markOrderPaid, placeOrder } from "../src/application/order.service";
import { closeGroupBuy } from "../src/application/group-buy.service";
import { awardRfq, confirmPurchaseOrder, createRfqFromGroupBuy, getRfqWithRanking, shipPurchaseOrder, submitRfqResponse } from "../src/application/procurement.service";
import { lotLedger, prepareStockItems, receivePurchaseOrder, recordFractionation } from "../src/application/inventory.service";
import { assignDriver, dispatchToPickupPoints, driverDeliver, driverPickup, driverRespond, pickupHandover, pickupReceive } from "../src/application/delivery.service";
import { consolidatedDemand } from "../src/application/group-buy.service";
import { slugify } from "../src/domain/community";
import { CATEGORIES, COMMUNES_ZONES, COMMUNITIES, FIRST_NAMES, LAST_NAMES, PICKUP_POINTS, PRODUCTS, SUPPLIERS } from "./seed-data";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  console.error("Seed refusé en production.");
  process.exit(1);
}

const NOW = new Date();
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);

// Générateur pseudo-aléatoire déterministe (mulberry32)
let seedState = 20261003;
function rand() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
let codeSeq = 0;
const code = (prefix: string) => `${prefix}${(++codeSeq).toString(36).toUpperCase().padStart(4, "0")}`;

async function reset() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
}

async function main() {
  const t0 = Date.now();
  console.log("→ Réinitialisation…");
  await reset();
  // Démo hébergée : DEMO_PASSWORD remplace le mot de passe public des comptes de démo.
  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD || "sesam2026");

  const mkUser = (data: Omit<Prisma.UserCreateInput, "passwordHash" | "referralCode"> & { referralCode?: string }) =>
    prisma.user.create({ data: { passwordHash, referralCode: data.referralCode ?? code("SES"), ...data } });

  // ─── Référentiels ───────────────────────────────────────
  console.log("→ Catalogue, zones, points relais…");
  const cats = new Map<string, string>();
  for (const [i, c] of CATEGORIES.entries()) cats.set(c.slug, (await prisma.category.create({ data: { ...c, sortOrder: i } })).id);

  const warehouse = await prisma.warehouse.create({ data: { name: "Entrepôt Sesam-Market Yopougon", commune: "Yopougon", address: "Zone industrielle, lot 42" } });
  for (const z of COMMUNES_ZONES) {
    await prisma.deliveryZone.create({ data: { commune: z.commune, baseFee: z.baseFee, distanceKm: z.distanceKm, perKmFee: 20, perKgFee: 50, includedWeightKg: 10, scheduledSurcharge: 500, quartiers: z.quartiers } });
  }

  const perishableCats = new Set<string>(CATEGORIES.filter((c) => c.isPerishable).map((c) => c.slug));
  const products = new Map<string, { id: string; variantId: string; price: number; qty: number; unit: string; perishable: boolean }>();
  for (const [i, row] of PRODUCTS.entries()) {
    const [cat, name, brand, emoji, unit, vLabel, qty, weight, price, ref] = row;
    const fullName = brand ? `${name} ${brand}` : name;
    let slug = slugify(fullName);
    if (products.has(slug)) slug = `${slug}-${i}`;
    const p = await prisma.product.create({
      data: {
        slug,
        name,
        brand,
        emoji,
        baseUnit: unit,
        categoryId: cats.get(cat)!,
        description: `${name}${brand ? ` de marque ${brand}` : ""}, sélectionné par Sesam-Market auprès de fournisseurs vérifiés.`,
        popularity: between(5, 100),
        variants: { create: { sku: `SKU-${String(i + 1).padStart(3, "0")}`, name: vLabel, quantityBase: qty, weightGrams: weight, canariPrice: price } },
      },
      include: { variants: true },
    });
    const v = p.variants[0];
    // Relevés de prix : récents pour la plupart ; quelques-uns volontairement périmés (> 30 j).
    const stale = i % 17 === 5;
    await prisma.referencePrice.createMany({
      data: [
        { variantId: v.id, price: Math.round((ref * 1.02) / 25) * 25, source: "MARKET_SURVEY", sourceLabel: "Relevé Sesam-Market, marchés d'Adjamé et de Cocody", method: "Médiane de 3 relevés en boutique et au marché", observedAt: daysAgo(stale ? 75 : 40) },
        { variantId: v.id, price: ref, source: i % 3 ? "MARKET_SURVEY" : "RETAILER_PRICE", sourceLabel: i % 3 ? "Relevé Sesam-Market, marché d'Adjamé" : "Prix affiché en supérette (Cocody)", method: "Médiane de 3 relevés", observedAt: daysAgo(stale ? 45 : between(1, 20)) },
      ],
    });
    await prisma.inventory.create({ data: { warehouseId: warehouse.id, productId: p.id, quantityBase: qty * between(150, 400) } });
    products.set(slug, { id: p.id, variantId: v.id, price: price ?? 0, qty, unit, perishable: perishableCats.has(cat) });
  }
  const productBy = (name: string) => {
    const e = [...products.entries()].find(([s]) => s.startsWith(slugify(name)));
    if (!e) throw new Error(`Produit introuvable : ${name}`);
    return e[1];
  };

  // ─── Comptes ────────────────────────────────────────────
  console.log("→ Comptes (admins, fournisseurs, livreurs, points relais, ménages)…");
  const admin = await mkUser({ phone: "+2250700000099", firstName: "Admin", lastName: "Sesam-Market", role: "ADMIN", adminPermissions: ["SUPER_ADMIN"], commune: "Plateau", quartier: "Centre", referralCode: "SESADMIN" });
  await mkUser({ phone: "+2250700000098", firstName: "Opérations", lastName: "Sesam-Market", role: "ADMIN", adminPermissions: ["ORDERS_MANAGE", "LOGISTICS_MANAGE", "ANALYTICS_VIEW"], commune: "Yopougon", quartier: "Zone industrielle" });

  const points = new Map<string, { id: string; managerId: string }>();
  for (const [i, p] of PICKUP_POINTS.entries()) {
    const manager = await mkUser({ phone: `+22501000001${String(i + 1).padStart(2, "0")}`, firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES), role: "PICKUP_POINT", commune: p.commune, quartier: p.quartier });
    const pp = await prisma.pickupPoint.create({
      data: { code: p.code, name: p.name, commune: p.commune, quartier: p.quartier, address: p.address, landmark: p.landmark, openingHours: "Lun–Sam 8 h–20 h, Dim 9 h–13 h", managerUserId: manager.id, customerFee: p.fee, feePerParcel: 150 },
    });
    points.set(p.code, { id: pp.id, managerId: manager.id });
  }

  const drivers: Array<{ id: string; userId: string }> = [];
  for (let i = 1; i <= 4; i++) {
    const u = await mkUser({ phone: `+225010000000${i}`, firstName: pick(FIRST_NAMES), lastName: pick(LAST_NAMES), role: "DRIVER", commune: pick(COMMUNES_ZONES).commune, quartier: "—" });
    const d = await prisma.driver.create({ data: { userId: u.id, vehicleType: i === 4 ? "tricycle" : "moto", communes: COMMUNES_ZONES.slice(0, 6).map((z) => z.commune) } });
    drivers.push({ id: d.id, userId: u.id });
  }

  const suppliers: Array<{ id: string; userId: string; name: string; verified: boolean }> = [];
  for (const [i, s] of SUPPLIERS.entries()) {
    const u = await mkUser({ phone: `+22505000000${String(i + 1).padStart(2, "0")}`, firstName: s.name.split(" ")[0], lastName: "(fournisseur)", role: "SUPPLIER", commune: s.commune, quartier: "—" });
    const sup = await prisma.supplier.create({
      data: {
        userId: u.id,
        businessName: s.name,
        type: s.type,
        registrationNumber: `CI-ABJ-2019-B-${10000 + i * 137}`,
        taxId: `${1900000 + i * 911}X`,
        commune: s.commune,
        contactPhone: u.phone,
        verificationStatus: s.verified ? "VERIFIED" : i % 2 ? "IN_REVIEW" : "PENDING",
        qualityScore: s.quality,
        reliabilityScore: s.reliability,
        onTimeRateBps: s.reliability * 100,
        description: `${s.type === "COOPERATIVE" ? "Coopérative" : "Entreprise"} basée à ${s.commune}.`,
        verifications: { create: [{ documentType: "RCCM", documentKey: `kyb/${i}/rccm.pdf`, status: s.verified ? "VERIFIED" : "PENDING", reviewedAt: s.verified ? daysAgo(200) : null }, { documentType: "DFE", documentKey: `kyb/${i}/dfe.pdf`, status: s.verified ? "VERIFIED" : "PENDING" }] },
      },
    });
    suppliers.push({ id: sup.id, userId: u.id, name: s.name, verified: s.verified });
  }
  const sup = (name: string) => suppliers.find((s) => s.name === name)!;

  // Ménages et commerçants
  const households: Array<{ id: string; commune: string }> = [];
  const awa = await mkUser({ phone: "+2250700000001", firstName: "Awa", lastName: "Kouassi", role: "HOUSEHOLD", commune: "Cocody", quartier: "Angré 8e Tranche", referralCode: "SESAWA01", household: { create: { adults: 2, children: 3 } } });
  households.push({ id: awa.id, commune: "Cocody" });
  for (let i = 2; i <= 130; i++) {
    const zone = pick(COMMUNES_ZONES.slice(0, 7));
    const merchant = i > 115;
    const u = await mkUser({
      phone: `+2250701${String(i).padStart(6, "0")}`,
      firstName: pick(FIRST_NAMES),
      lastName: pick(LAST_NAMES),
      role: merchant ? "MERCHANT" : "HOUSEHOLD",
      commune: zone.commune,
      quartier: pick(zone.quartiers),
      referredBy: i % 9 === 0 ? { connect: { id: awa.id } } : undefined,
      createdAt: daysAgo(between(5, 200)),
      household: merchant ? undefined : { create: { adults: between(1, 4), children: between(0, 5) } },
      merchant: merchant ? { create: { businessName: `Boutique ${pick(LAST_NAMES)}`, businessType: "Alimentation générale", commune: zone.commune } } : undefined,
      consents: { create: [{ type: "TERMS", granted: true, version: "2026-10" }, { type: "PRIVACY", granted: true, version: "2026-10" }, { type: "MARKETING_SMS", granted: rand() > 0.5, version: "2026-10" }] },
    });
    if (i % 9 === 0) await prisma.referral.create({ data: { referrerId: awa.id, refereeId: u.id } });
    households.push({ id: u.id, commune: zone.commune });
  }
  await prisma.consentRecord.createMany({ data: [{ userId: awa.id, type: "TERMS", granted: true, version: "2026-10" }, { userId: awa.id, type: "PRIVACY", granted: true, version: "2026-10" }, { userId: awa.id, type: "MARKETING_WHATSAPP", granted: true, version: "2026-10" }] });
  await prisma.address.create({ data: { userId: awa.id, label: "Maison", commune: "Cocody", quartier: "Angré 8e Tranche", landmark: "Villa 214, portail vert", isDefault: true } });

  // Communautés : membres selon la commune
  console.log("→ Communautés…");
  const communityIds: string[] = [];
  for (const c of COMMUNITIES) {
    const creator = households.find((h) => h.commune === c.commune) ?? households[1];
    const members = households.filter((h) => h.commune === c.commune && rand() > 0.35).slice(0, 40);
    const cm = await prisma.community.create({
      data: {
        slug: slugify(c.name),
        name: c.name,
        type: c.type,
        commune: c.commune,
        quartier: c.quartier,
        description: `Les habitants et membres de ${c.name.replace("Sesam ", "")} achètent ensemble pour payer moins cher.`,
        createdById: creator.id,
        pickupPointId: c.point ? points.get(c.point)!.id : null,
        deliveryWeekday: c.weekday,
        inviteCode: code("INV"),
        isPublic: c.type !== "COMPANY",
        members: { create: [{ userId: creator.id, role: "ADMIN" }, ...members.filter((m) => m.id !== creator.id).map((m) => ({ userId: m.id }))] },
      },
      include: { _count: { select: { members: true } } },
    });
    await prisma.community.update({ where: { id: cm.id }, data: { memberCount: cm._count.members } });
    communityIds.push(cm.id);
  }
  if (!(await prisma.communityMember.findFirst({ where: { userId: awa.id, communityId: communityIds[0] } }))) {
    await prisma.communityMember.create({ data: { userId: awa.id, communityId: communityIds[0] } });
    await prisma.community.update({ where: { id: communityIds[0] }, data: { memberCount: { increment: 1 } } });
  }

  // Produits référencés par fournisseur (éligibilité RFQ)
  const supplierCatalog: Array<[string, string[]]> = [
    ["Riz du Nord SARL", ["riz-parfume-long-grain", "riz-brise", "riz-parfume-premium"]],
    ["Coopérative rizicole de Gbêkê", ["riz-local-bouake", "riz-parfume-long-grain"]],
    ["Ivoire Import Alimentaire", ["riz-parfume-long-grain", "riz-brise", "huile-d-arachide", "sucre-en-poudre", "spaghetti", "concentre-de-tomate", "lait-en-poudre"]],
    ["Huileries de l'Agnéby", ["huile-de-palme-raffinee"]],
    ["Sucrerie du Sud Distribution", ["sucre-en-poudre", "sucre-en-morceaux"]],
    ["Grands Moulins Grossiste Adjamé", ["farine-de-ble", "huile-de-palme-raffinee", "sucre-en-poudre"]],
    ["Ferme avicole d'Azaguié", ["oeufs-frais", "poulet-entier"]],
    ["Coopérative des pêcheurs de Grand-Lahou", ["poisson-fume"]],
    ["Frigo Poissons Abidjan", ["chinchard", "maquereau", "poisson-fume"]],
    ["Maraîchers de Bouaflé", ["tomates-fraiches", "oignons", "pommes-de-terre"]],
    ["Hygiène Plus Distribution", ["lessive-en-poudre", "savon-de-toilette", "dentifrice", "serviettes-hygieniques"]],
    ["Détergents de Vridi", ["lessive-en-poudre", "eau-de-javel", "liquide-vaisselle"]],
    ["Papeterie Centrale du Plateau", ["kit-scolaire-primaire", "cahiers-100-pages", "stylos-a-bille"]],
    ["Grossiste Bon Prix Abobo", ["riz-parfume-long-grain", "huile-de-palme-raffinee", "oignons"]],
  ];
  for (const [sname, slugs] of supplierCatalog) {
    for (const s of slugs) {
      for (const [pslug, p] of products) {
        if (!pslug.startsWith(s)) continue;
        await prisma.supplierProduct
          .create({ data: { supplierId: sup(sname).id, productId: p.id, supplierUnitLabel: "Lot fournisseur", supplierUnitQuantityBase: p.qty * 10, capacityUnitsPerWeek: between(50, 500), leadTimeDays: between(2, 7), priceTiers: { create: [{ minUnits: 1, unitPrice: Math.round(p.price * 10 * 0.82) }] } } })
          .catch(() => undefined);
      }
    }
  }

  // ─── Achats groupés ─────────────────────────────────────
  console.log("→ Achats groupés…");
  type GbDef = {
    title: string; product: string; unitLabel: string; unitBase: number; target: number; max: number;
    tiers: Array<[number, number]>; ref: number; cost: number; portions: Array<[string, number]>; fee: number;
    policy: "EXTEND" | "REFUND" | "ALTERNATIVE_PRICE" | "CREDIT_WITH_CONSENT"; opens: number; closes: number; delivery: number;
    fill: number; supplier: string; community?: number; avg: number;
  };
  const defs: GbDef[] = [
    // Passés et livrés
    { title: "Riz parfumé, sac de 50 kg (juin)", product: "Riz parfumé long grain", unitLabel: "Sac 50 kg", unitBase: 50_000, target: 120, max: 300, tiers: [[40, 26_500], [80, 25_500], [120, 24_500]], ref: 27_500, cost: 22_200, portions: [["5 kg", 5000], ["10 kg", 10_000], ["25 kg", 25_000], ["50 kg", 50_000]], fee: 150, policy: "REFUND", opens: 125, closes: 110, delivery: 104, fill: 1.08, supplier: "Riz du Nord SARL", avg: 12_000 },
    { title: "Huile de palme, bidon de 20 L (juillet)", product: "Huile de palme raffinée Dinor", unitLabel: "Bidon 20 L", unitBase: 20_000, target: 60, max: 150, tiers: [[20, 25_000], [40, 24_000], [60, 23_200]], ref: 26_500, cost: 20_500, portions: [["1 L", 1000], ["5 L", 5000], ["20 L", 20_000]], fee: 100, policy: "EXTEND", opens: 90, closes: 76, delivery: 70, fill: 0.85, supplier: "Huileries de l'Agnéby", avg: 4_000 },
    { title: "Sucre en poudre, sac de 50 kg (août)", product: "Sucre en poudre", unitLabel: "Sac 50 kg", unitBase: 50_000, target: 40, max: 100, tiers: [[15, 36_000], [30, 34_500], [40, 33_800]], ref: 39_500, cost: 30_500, portions: [["1 kg", 1000], ["5 kg", 5000], ["25 kg", 25_000], ["50 kg", 50_000]], fee: 100, policy: "REFUND", opens: 62, closes: 48, delivery: 42, fill: 1.1, supplier: "Sucrerie du Sud Distribution", avg: 6_000 },
    { title: "Lessive en poudre, carton de 10 kg (septembre)", product: "Lessive en poudre OMO", unitLabel: "Carton 10 kg", unitBase: 10_000, target: 50, max: 120, tiers: [[20, 11_200], [35, 10_800], [50, 10_400]], ref: 13_200, cost: 9_000, portions: [["1 kg", 1000], ["3 kg", 3000], ["10 kg", 10_000]], fee: 100, policy: "REFUND", opens: 38, closes: 26, delivery: 21, fill: 0.95, supplier: "Hygiène Plus Distribution", community: 0, avg: 3_000 },
    // Passé, non abouti (remboursement)
    { title: "Lait en poudre, carton de 12 boîtes", product: "Lait en poudre entier", unitLabel: "Carton 12 boîtes", unitBase: 4_800, target: 60, max: 120, tiers: [[40, 34_500], [60, 33_000]], ref: 38_400, cost: 29_000, portions: [["1 boîte", 400], ["3 boîtes", 1_200], ["12 boîtes", 4_800]], fee: 0, policy: "REFUND", opens: 24, closes: 12, delivery: 8, fill: 0.4, supplier: "Ivoire Import Alimentaire", avg: 1_200 },
    // En cours
    { title: "Riz parfumé, sac de 50 kg", product: "Riz parfumé long grain", unitLabel: "Sac 50 kg", unitBase: 50_000, target: 200, max: 600, tiers: [[50, 26_500], [100, 25_500], [200, 24_500], [500, 23_800]], ref: 27_500, cost: 22_000, portions: [["5 kg", 5000], ["10 kg", 10_000], ["25 kg", 25_000], ["50 kg", 50_000]], fee: 150, policy: "EXTEND", opens: 9, closes: -6, delivery: -10, fill: 0.865, supplier: "Riz du Nord SARL", avg: 12_500 },
    { title: "Huile de palme, bidon de 20 L", product: "Huile de palme raffinée Dinor", unitLabel: "Bidon 20 L", unitBase: 20_000, target: 120, max: 250, tiers: [[40, 24_800], [80, 23_900], [120, 23_200]], ref: 26_500, cost: 20_300, portions: [["1 L", 1000], ["5 L", 5000], ["20 L", 20_000]], fee: 100, policy: "REFUND", opens: 7, closes: -4, delivery: -9, fill: 0.92, supplier: "Huileries de l'Agnéby", avg: 4_500 },
    { title: "Spaghetti, carton de 20 paquets", product: "Spaghetti", unitLabel: "Carton 20 paquets", unitBase: 10_000, target: 80, max: 160, tiers: [[30, 7_600], [60, 7_300], [80, 7_000]], ref: 9_000, cost: 6_000, portions: [["5 paquets", 2_500], ["10 paquets", 5_000], ["20 paquets", 10_000]], fee: 0, policy: "ALTERNATIVE_PRICE", opens: 5, closes: -5, delivery: -8, fill: 0.46, supplier: "Ivoire Import Alimentaire", avg: 4_000 },
    { title: "Kits scolaires primaire, carton de 10", product: "Kit scolaire primaire", unitLabel: "Carton de 10 kits", unitBase: 10, target: 60, max: 120, tiers: [[20, 92_000], [40, 88_000], [60, 85_000]], ref: 118_000, cost: 72_000, portions: [["1 kit", 1], ["2 kits", 2], ["5 kits", 5], ["10 kits", 10]], fee: 0, policy: "CREDIT_WITH_CONSENT", opens: 3, closes: -12, delivery: -16, fill: 0.31, supplier: "Papeterie Centrale du Plateau", avg: 2 },
    { title: "Savon de ménage, carton de 48 barres", product: "Savon de ménage", unitLabel: "Carton 48 barres", unitBase: 48, target: 50, max: 100, tiers: [[20, 11_800], [35, 11_400], [50, 11_000]], ref: 13_600, cost: 9_300, portions: [["6 barres", 6], ["12 barres", 12], ["48 barres", 48]], fee: 0, policy: "REFUND", opens: 4, closes: -3, delivery: -5, fill: 0.7, supplier: "Hygiène Plus Distribution", community: 0, avg: 12 },
  ];

  const pickupCodes = PICKUP_POINTS.map((p) => p.code);
  let orderCount = 0;

  async function payOrder(orderId: string, at: Date, method: "MOBILE_MONEY" | "CARD" = "MOBILE_MONEY") {
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status !== "PENDING_PAYMENT") return;
    await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: { orderId, provider: "mock", method, operator: method === "MOBILE_MONEY" ? pick(["ORANGE_MONEY", "MTN_MOMO", "MOOV_MONEY", "WAVE"] as const) : null, amount: order.total, status: "PAID", providerRef: `mock_seed_${orderId}`, idempotencyKey: `seed:${orderId}`, expiresAt: new Date(at.getTime() + 1_800_000), paidAt: at, createdAt: at },
      });
      await tx.paymentTransaction.create({ data: { paymentId: p.id, type: "WEBHOOK", provider: "mock", providerEventId: `seed_${orderId}`, amount: order.total, status: "PAID", payload: { seed: true } } });
      await markOrderPaid(tx, orderId, p.id, at);
    }, { timeout: 20_000 });
  }

  function destination(userId: string, commune: string): { mode: FulfillmentMode; pointId?: string } {
    if (rand() < 0.7) {
      const sameCommune = PICKUP_POINTS.filter((p) => p.commune === commune).map((p) => p.code);
      return { mode: "PICKUP", pointId: points.get(pick(sameCommune.length ? sameCommune : pickupCodes))!.id };
    }
    return { mode: "HOME_DELIVERY" };
  }

  async function checkout(userId: string, commune: string, at: Date) {
    const dest = destination(userId, commune);
    let order;
    if (dest.mode === "PICKUP") {
      order = await placeOrder(userId, { fulfillmentMode: "PICKUP", pickupPointId: dest.pointId, deliverySpeed: "STANDARD", useCredit: false, creditConsent: rand() > 0.6 }, null, prisma, at);
    } else {
      const zone = COMMUNES_ZONES.find((z) => z.commune === commune) ?? COMMUNES_ZONES[0];
      order = await placeOrder(userId, { fulfillmentMode: "HOME_DELIVERY", newAddress: { label: "Domicile", commune: zone.commune as never, quartier: pick(zone.quartiers), landmark: "Près du maquis" }, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null, prisma, at);
    }
    orderCount++;
    return order;
  }

  async function fulfil(orderIds: string[]) {
    for (const id of orderIds) {
      const o = await prisma.order.findUniqueOrThrow({ where: { id }, include: { delivery: true } });
      if (o.status !== "READY" || !o.delivery) continue;
      if (o.fulfillmentMode === "PICKUP") {
        const point = [...points.values()].find((p) => p.id === o.pickupPointId)!;
        await dispatchToPickupPoints([id], admin.id);
        await pickupReceive(point.managerId, o.number);
        if (rand() < 0.97) await pickupHandover(point.managerId, o.number, o.pickupCode);
      } else {
        const d = pick(drivers);
        await assignDriver(id, d.id, admin.id);
        await driverRespond(d.userId, o.delivery.id, true);
        await driverPickup(d.userId, o.delivery.id);
        await driverDeliver(d.userId, o.delivery.id, o.pickupCode);
      }
    }
  }

  for (const [gi, def] of defs.entries()) {
    const product = productBy(def.product);
    const opensAt = daysAgo(def.opens);
    const closesAt = daysAgo(def.closes);
    const gb = await prisma.groupBuy.create({
      data: {
        slug: slugify(def.title),
        title: def.title,
        description: `Achat groupé direct auprès de ${def.supplier}. Sesam-Market réceptionne, contrôle la qualité, fractionne et livre dans votre quartier.`,
        productId: product.id,
        communityId: def.community !== undefined ? communityIds[def.community] : null,
        status: "OPEN",
        supplierUnitLabel: def.unitLabel,
        supplierUnitQuantityBase: def.unitBase,
        targetUnits: def.target,
        maxUnits: def.max,
        referenceUnitPrice: def.ref,
        referenceSource: "Relevé Sesam-Market, marchés d'Adjamé, Yopougon et Cocody",
        referenceMethod: "Médiane de 3 relevés au prix de gros-détail, même conditionnement",
        referenceObservedAt: new Date(opensAt.getTime() - 2 * DAY),
        opensAt,
        closesAt,
        expectedDeliveryAt: daysAgo(def.delivery),
        failurePolicy: def.policy,
        alternativeUnitPrice: def.policy === "ALTERNATIVE_PRICE" ? def.tiers[0][1] + 900 : null,
        supplierUnitCost: def.cost,
        inboundTransportPerUnit: Math.round(def.cost * 0.02),
        storagePerUnit: Math.round(def.cost * 0.008),
        fractionationFeePerPortion: def.fee,
        fractionationCostPerPortion: Math.round(def.fee * 0.45),
        packagingCostPerPortion: Math.round(def.fee * 0.3),
        lossRateBps: 100,
        paymentFeeBps: 150,
        deliveryCostPerOrder: 50,
        expectedAvgPortionBase: def.avg,
        publishedAt: opensAt,
        publishedById: admin.id,
        tiers: { create: def.tiers.map(([minUnits, unitPrice]) => ({ minUnits, unitPrice })) },
        portions: { create: def.portions.map(([label, quantityBase], i) => ({ label, quantityBase, sortOrder: i })) },
      },
      include: { portions: true },
    });

    // Participations jusqu'au taux de remplissage visé
    const goalBase = Math.floor(def.target * def.fill * def.unitBase);
    const orderIds: string[] = [];
    const span = Math.max(1, def.opens - Math.max(def.closes, 0));
    let guard = 0;
    while (guard++ < 600) {
      const g = await prisma.groupBuy.findUniqueOrThrow({ where: { id: gb.id } });
      if (g.committedBase >= goalBase) break;
      const buyer = pick(households);
      const isMerchant = households.indexOf(buyer) > 114;
      const portions = [...gb.portions].sort((a, b) => a.quantityBase - b.quantityBase);
      const portion = isMerchant ? portions[portions.length - 1] : rand() < 0.15 ? portions[portions.length - 1] : pick(portions.slice(0, -1));
      const qty = isMerchant ? between(1, 4) : between(1, 2);
      if (g.committedBase + g.heldBase + portion.quantityBase * qty > def.max * def.unitBase) continue;
      const at = new Date(opensAt.getTime() + rand() * span * DAY);
      // Panier rempli directement : l'achat peut être dans le passé (addToCart contrôle « maintenant »).
      const cart = await prisma.cart.upsert({ where: { userId: buyer.id }, create: { userId: buyer.id }, update: {} });
      await prisma.cartItem.create({ data: { cartId: cart.id, kind: "GROUP_BUY", groupBuyId: gb.id, portionId: portion.id, quantity: qty } });
      try {
        const order = await checkout(buyer.id, buyer.commune, at);
        await payOrder(order.id, new Date(at.getTime() + 120_000));
        orderIds.push(order.id);
      } catch {
        await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
      }
    }
    // La démo : Awa participe au riz en cours
    if (gi === 5) {
      await addToCart(awa.id, { kind: "GROUP_BUY", portionId: gb.portions.find((p) => p.quantityBase === 25_000)!.id, quantity: 1 }, prisma);
      const o = await placeOrder(awa.id, { fulfillmentMode: "PICKUP", pickupPointId: points.get("PR-ANG")!.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null, prisma, daysAgo(2));
      await payOrder(o.id, daysAgo(2));
      orderCount++;
    }

    if (def.closes <= 0) {
      console.log(`   ${def.title} : ${orderIds.length} commandes (en cours)`);
      continue;
    }

    // Clôture à l'échéance (date passée)
    const res = await closeGroupBuy(gb.id, null, {}, prisma, new Date(closesAt.getTime() + 60_000));
    if (res.action === "EXTEND") await closeGroupBuy(gb.id, null, { force: "success" }, prisma, new Date(closesAt.getTime() + 2 * DAY));
    const closed = await prisma.groupBuy.findUniqueOrThrow({ where: { id: gb.id } });
    console.log(`   ${def.title} : ${orderIds.length} commandes → ${closed.status}`);
    if (closed.status !== "CLOSED_SUCCESS") continue;

    // Approvisionnement : RFQ, offres concurrentes, attribution motivée
    const rfq = await createRfqFromGroupBuy(gb.id, { quality: "Conforme à l'échantillon validé", packaging: def.unitLabel, destination: "Entrepôt Sesam-Market Yopougon", neededBy: new Date(Date.now() + 5 * DAY), closesAt: new Date(Date.now() + 2 * DAY) }, admin.id);
    const bidders = [sup(def.supplier), ...suppliers.filter((s) => s.verified && s.name !== def.supplier).slice(gi, gi + 2)];
    for (const [bi, b] of bidders.entries()) {
      const spId = await prisma.supplierProduct.findFirst({ where: { supplierId: b.id, productId: product.id } });
      if (!spId) await prisma.supplierProduct.create({ data: { supplierId: b.id, productId: product.id, supplierUnitLabel: def.unitLabel, supplierUnitQuantityBase: def.unitBase, capacityUnitsPerWeek: def.max, leadTimeDays: 3 } });
      await submitRfqResponse(b.userId, rfq.id, { unitPrice: def.cost + bi * Math.round(def.cost * (bi === 1 ? -0.015 : 0.02)), unitsOffered: def.max, leadTimeDays: 2 + bi * 2, deliveryLocation: "Entrepôt Sesam-Market Yopougon", validUntil: new Date(Date.now() + 10 * DAY), conditions: "Paiement à 15 jours après réception" });
    }
    const { ranked } = await getRfqWithRanking(rfq.id);
    const po = await awardRfq(rfq.id, ranked[0].responseId, null, admin.id);
    const poOwner = suppliers.find((s) => s.id === po.supplierId)!;
    await confirmPurchaseOrder(poOwner.userId, po.id);
    await shipPurchaseOrder(poOwner.userId, po.id);
    const poItem = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { purchaseOrderId: po.id } });
    await receivePurchaseOrder(po.id, { receivedUnits: poItem.units, damagedBase: 0, note: "Contrôle qualité OK" }, admin.id);
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { paidToSupplierAt: gi < 3 ? new Date() : null } });

    // Fractionnement selon la demande consolidée
    const { demand } = await consolidatedDemand(gb.id);
    for (const line of demand.byPortion) {
      // Perte constatée réaliste, bornée par le vrac réellement disponible.
      const { ledger } = await lotLedger(gb.id);
      const slack = ledger.bulkRemainingBase - line.totalBase;
      const loss = line.isFullUnit ? 0 : Math.max(0, Math.min(Math.floor(line.totalBase * 0.004), slack));
      await recordFractionation(gb.id, { portionBase: line.portionBase, portionCount: line.portions, lossBase: loss }, admin.id);
    }
    await prisma.groupBuy.update({ where: { id: gb.id }, data: { status: "COMPLETED" } });
    await fulfil(orderIds);
  }

  // ─── Ventes en stock (historique sur 6 mois) ────────────
  console.log("→ Commandes en stock (historique)…");
  // Phase 1 : historique de ventes uniquement sur le non périssable.
  const stockProducts = [...products.values()].filter((p) => !p.perishable);
  const stockOrderIds: string[] = [];
  for (let i = 0; i < 170; i++) {
    const buyer = i < 6 ? households[0] : pick(households);
    const at = daysAgo(i < 6 ? 150 - i * 25 : between(1, 175));
    const nLines = between(1, 5);
    for (let k = 0; k < nLines; k++) {
      await addToCart(buyer.id, { kind: "STOCK", variantId: pick(stockProducts).variantId, quantity: between(1, 3) }, prisma);
    }
    try {
      const order = await checkout(buyer.id, buyer.commune, at);
      await payOrder(order.id, new Date(at.getTime() + 60_000), rand() < 0.8 ? "MOBILE_MONEY" : "CARD");
      stockOrderIds.push(order.id);
    } catch (e) {
      await prisma.cartItem.deleteMany({ where: { cart: { userId: buyer.id } } });
      console.warn("   commande ignorée :", (e as Error).message);
    }
  }
  // La plupart sont préparées et livrées ; les plus récentes restent en cours.
  for (const [i, id] of stockOrderIds.entries()) {
    const o = await prisma.order.findUniqueOrThrow({ where: { id } });
    if (o.status !== "RECEIVED_WAREHOUSE") continue;
    const recent = o.createdAt > daysAgo(3);
    if (recent && i % 2) continue; // en attente de préparation
    await prepareStockItems(id, admin.id);
    if (recent) continue; // prête, en attente d'expédition
    await fulfil([id]);
  }
  // Démo : une commande d'Awa disponible au point relais (code de retrait visible)
  await addToCart(awa.id, { kind: "STOCK", variantId: productBy("Huile de palme raffinée Aya").variantId, quantity: 2 }, prisma);
  await addToCart(awa.id, { kind: "STOCK", variantId: productBy("Savon de ménage").variantId, quantity: 1 }, prisma);
  const awaOrder = await placeOrder(awa.id, { fulfillmentMode: "PICKUP", pickupPointId: points.get("PR-ANG")!.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null, prisma, daysAgo(1));
  await payOrder(awaOrder.id, daysAgo(1));
  await prepareStockItems(awaOrder.id, admin.id);
  await dispatchToPickupPoints([awaOrder.id], admin.id);
  await pickupReceive(points.get("PR-ANG")!.managerId, awaOrder.number);
  orderCount++;

  // Une commande en attente de paiement (pour tester la reprise)
  await addToCart(households[3].id, { kind: "STOCK", variantId: productBy("Sucre en poudre").variantId, quantity: 2 }, prisma);
  await checkout(households[3].id, households[3].commune, new Date());

  // ─── Paniers famille, promotions, avis, support ─────────
  console.log("→ Paniers famille, promotions, avis…");
  const basket = async (slug: string, name: string, target: number, hint: string, description: string, items: Array<[string, number]>, sortOrder: number) =>
    prisma.familyBasket.create({ data: { slug, name, targetPrice: target, householdHint: hint, description, sortOrder, items: { create: items.map(([n, q]) => ({ variantId: productBy(n).variantId, quantity: q })) } } });
  await basket("panier-essentiel", "Panier Essentiel", 10_000, "1 à 2 personnes", "Les indispensables de la semaine.", [["Riz parfumé long grain", 1], ["Huile de palme raffinée Aya", 1], ["Sucre en poudre", 1], ["Spaghetti", 2], ["Concentré de tomate", 1], ["Savon de ménage", 1], ["Sel iodé", 1]], 0);
  await basket("panier-famille", "Panier Famille", 25_000, "4 à 5 personnes", "Deux semaines de base pour une famille.", [["Riz parfumé long grain", 2], ["Huile de palme raffinée Dinor", 1], ["Sucre en poudre", 2], ["Farine de blé", 2], ["Spaghetti", 4], ["Concentré de tomate", 2], ["Lait concentré sucré", 2], ["Lessive en poudre Kalia", 1], ["Savon de ménage", 1], ["Papier hygiénique", 1]], 1);
  await basket("panier-famille-plus", "Panier Famille Plus", 50_000, "6 personnes et plus", "Le mois complet : alimentation, entretien et hygiène.", [["Riz parfumé premium", 2], ["Riz parfumé long grain", 2], ["Huile de palme raffinée Dinor", 2], ["Sucre en poudre", 3], ["Farine de blé", 2], ["Spaghetti", 6], ["Concentré de tomate", 4], ["Lait en poudre entier", 1], ["Sardines à l'huile", 4], ["Lessive en poudre OMO", 1], ["Savon de ménage", 2], ["Papier hygiénique", 1], ["Dentifrice", 2]], 2);

  await prisma.promotion.createMany({
    data: [
      { code: "BIENVENUE10", description: "−10 % sur la première commande (min. 10 000 F)", type: "PERCENT", value: 10, minOrder: 10_000, maxUses: 1000, startsAt: daysAgo(30), endsAt: new Date(NOW.getTime() + 90 * DAY) },
      { code: "RETRAITOFFERT", description: "Frais de retrait offerts", type: "FREE_DELIVERY", value: 0, minOrder: 5_000, maxUses: 500, startsAt: daysAgo(10), endsAt: new Date(NOW.getTime() + 30 * DAY) },
    ],
  });

  const delivered = await prisma.order.findMany({ where: { status: "DELIVERED" }, include: { items: { take: 1 } }, take: 80 });
  for (const o of delivered.slice(0, 60)) {
    await prisma.review.create({ data: { userId: o.userId, orderId: o.id, target: "ORDER", rating: between(3, 5), comment: pick(["Très bon rapport qualité-prix.", "Retrait rapide au point relais.", "Riz de bonne qualité, merci Sesam-Market !", "Économie réelle par rapport au marché.", null]) } }).catch(() => undefined);
    if (o.items[0]) await prisma.review.create({ data: { userId: o.userId, orderId: o.id, target: "PRODUCT", productId: o.items[0].productId, rating: between(3, 5) } }).catch(() => undefined);
  }
  await prisma.supportTicket.create({ data: { userId: households[4].id, category: "DELIVERY", subject: "Horaires du point relais", messages: { create: { authorId: households[4].id, body: "Bonjour, le point relais de Niangon est-il ouvert le dimanche ?" } } } });
  await prisma.supportTicket.create({ data: { userId: awa.id, category: "PAYMENT", subject: "Remboursement de la différence de palier", status: "RESOLVED", messages: { create: { authorId: awa.id, body: "J'ai bien reçu le remboursement, merci pour la transparence !" } } } });

  // Événements de consultation (funnel) — sans données personnelles
  const viewers = households.slice(0, 120);
  await prisma.analyticsEvent.createMany({
    data: viewers.flatMap((h) => [
      { name: "group_buy_viewed", userId: h.id, createdAt: daysAgo(between(0, 25)) },
      ...(rand() < 0.6 ? [{ name: "checkout_started", userId: h.id, createdAt: daysAgo(between(0, 25)) }] : []),
    ]),
  });

  // Exécute les remboursements restants (différences de palier, échecs) comme le ferait la tâche planifiée.
  const { processPendingRefunds } = await import("../src/application/payment.service");
  for (let i = 0; i < 20 && (await prisma.refund.count({ where: { status: "PENDING" } })) > 0; i++) await processPendingRefunds(prisma);

  const counts = {
    users: await prisma.user.count(),
    suppliers: await prisma.supplier.count(),
    products: await prisma.product.count(),
    groupBuys: await prisma.groupBuy.count(),
    communities: await prisma.community.count(),
    pickupPoints: await prisma.pickupPoint.count(),
    orders: await prisma.order.count(),
    delivered: await prisma.order.count({ where: { status: "DELIVERED" } }),
  };
  console.log(`✔ Seed terminé en ${Math.round((Date.now() - t0) / 1000)} s (${orderCount} commandes passées par les services)`, counts);
  console.log(process.env.DEMO_PASSWORD ? "  Mot de passe des comptes de démo : valeur de DEMO_PASSWORD" : "  Mot de passe de tous les comptes de démo : sesam2026");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
