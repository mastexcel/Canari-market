import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { addToCart, addBasketToCart, getCart } from "@/application/cart.service";
import { placeOrder } from "@/application/order.service";
import { initiatePayment, simulateMockPayment } from "@/application/payment.service";
import { bestSavings, comparePrice, getBasket, getProduct, listCategories, searchProducts } from "@/application/catalog.service";
import { communityStats, createCommunity, getCommunity, joinCommunity, leaveCommunity, listCommunities } from "@/application/community.service";
import { prepareStockItems } from "@/application/inventory.service";
import { assignDriver, driverDeliver, driverMissions, driverPickup, driverRespond, logisticsBoard, reportIncident } from "@/application/delivery.service";
import { currentConsents, deleteAccount, exportUserData, setConsent } from "@/application/privacy.service";
import { createReview, createTicket, listTickets } from "@/application/support.service";
import { supplierDashboard, supplierRfq, updateSupplierProduct } from "@/application/supplier.service";
import { listOrdersAdmin, listSuppliers, listUsers, setAdminPermissions, setSupplierVerification, setUserStatus, dashboardKpis, dailySeries } from "@/application/admin.service";
import { userSavings, platformSavings } from "@/application/savings.service";
import { runScheduledJobs } from "@/application/jobs.service";
import { listNotifications, markAllRead, unreadCount, dispatchQueuedNotifications } from "@/application/notification.service";
import { login, createSession, getUserBySessionToken } from "@/application/auth.service";
import { baseFixture, makeUser, resetDb } from "./helpers";

const DAY = 86_400_000;
const pickup = (pickupPointId: string) => ({ fulfillmentMode: "PICKUP" as const, pickupPointId, deliverySpeed: "STANDARD" as const, useCredit: false, creditConsent: false });

describe("catalogue & comparateur", () => {
  beforeEach(resetDb);

  it("n'affiche une économie que si le relevé est récent", async () => {
    const now = new Date("2026-10-03");
    const fresh = comparePrice(2_600, [{ price: 3_000, observedAt: new Date("2026-09-25"), sourceLabel: "Relevé", method: "Médiane" }], now);
    expect(fresh).toMatchObject({ freshness: "fresh", saving: 400, savingBps: 1333 });
    const stale = comparePrice(2_600, [{ price: 3_000, observedAt: new Date("2026-06-01"), sourceLabel: "Relevé", method: "Médiane" }], now);
    expect(stale).toMatchObject({ freshness: "stale", saving: null });
    expect(comparePrice(2_600, [], now).freshness).toBe("none");
  });

  it("recherche, fiche produit, meilleures économies et paniers famille", async () => {
    const f = await baseFixture();
    expect((await listCategories())[0]._count.products).toBe(1);
    expect((await searchProducts({ q: "riz" }))[0].openGroupBuy?.slug).toBe("riz-50kg");
    expect(await searchProducts({ q: "introuvable" })).toHaveLength(0);
    const p = await getProduct("riz-parfume");
    expect(p.variants[0].available).toBe(20);
    expect((await bestSavings())[0].bestComparison?.saving).toBe(400);
    await prisma.familyBasket.create({ data: { slug: "essentiel", name: "Essentiel", description: "x", targetPrice: 10_000, householdHint: "2 pers.", items: { create: { variantId: f.variant.id, quantity: 2 } } } });
    const b = await getBasket("essentiel");
    expect(b).toMatchObject({ canariTotal: 5_200, referenceTotal: 6_000, saving: 800 });
    const user = await makeUser();
    await addBasketToCart(user.id, "essentiel");
    expect((await getCart(user.id)).lines[0].quantity).toBe(2);
    await expect(getProduct("nope")).rejects.toThrow(/introuvable/);
  });
});

describe("phase 1 : non périssable", () => {
  beforeEach(resetDb);

  it("masque et bloque les produits périssables, sauf si la phase 2 est ouverte", async () => {
    const f = await baseFixture();
    const frais = await prisma.category.create({ data: { slug: "frais", name: "Frais", emoji: "🐟", isPerishable: true } });
    const poisson = await prisma.product.create({
      data: { slug: "poisson-fume", name: "Poisson fumé", description: "x", categoryId: frais.id, baseUnit: "GRAM", emoji: "🐟", variants: { create: { sku: "P-1", name: "500 g", quantityBase: 500, weightGrams: 520, canariPrice: 2_300 } } },
      include: { variants: true },
    });
    const user = await makeUser();
    expect((await searchProducts({})).map((p) => p.slug)).toEqual(["riz-parfume"]);
    expect((await listCategories()).map((c) => c.slug)).toEqual(["alimentation"]);
    await expect(getProduct("poisson-fume")).rejects.toThrow(/bientôt/);
    await expect(addToCart(user.id, { kind: "STOCK", variantId: poisson.variants[0].id, quantity: 1 })).rejects.toThrow(/bientôt/);
    process.env.PERISHABLES_ENABLED = "true";
    try {
      expect((await searchProducts({})).length).toBe(2);
      await addToCart(user.id, { kind: "STOCK", variantId: poisson.variants[0].id, quantity: 1 });
    } finally {
      process.env.PERISHABLES_ENABLED = "false";
    }
    void f;
  });
});

describe("communautés", () => {
  beforeEach(resetDb);

  it("création, adhésion, statistiques, niveau et départ", async () => {
    const f = await baseFixture();
    const admin = await makeUser();
    const member = await makeUser();
    const c = await createCommunity(admin.id, { name: "Angré 8e Tranche", type: "NEIGHBORHOOD", commune: "Cocody", pickupPointId: f.pickupPoint.id, isPublic: false });
    expect(c.name).toBe("Sesam Angré 8e Tranche");
    await expect(joinCommunity(member.id, c.id, null)).rejects.toThrow(/privée/);
    await joinCommunity(member.id, c.id, c.inviteCode);
    await joinCommunity(member.id, c.id, c.inviteCode); // idempotent
    expect((await prisma.community.findUniqueOrThrow({ where: { id: c.id } })).memberCount).toBe(2);
    await expect(leaveCommunity(admin.id, c.id)).rejects.toThrow(/administrateur/);

    // Une commande payée d'un membre compte pour la communauté
    await addToCart(member.id, { kind: "STOCK", variantId: f.variant.id, quantity: 1 });
    const o = await placeOrder(member.id, pickup(f.pickupPoint.id), null);
    expect(o.communityId).toBe(c.id);
    await simulateMockPayment(member.id, (await initiatePayment(member.id, { orderId: o.id, method: "CARD", purpose: "ORDER" }, null)).paymentId, "PAID");
    const stats = await communityStats(c.id);
    expect(stats).toMatchObject({ totalOrders: 1, monthlyOrders: 1, totalSavings: 400 });
    expect(stats.next?.remainingOrders).toBe(9);
    const detail = await getCommunity(c.slug, member.id);
    expect(detail.membership).not.toBeNull();
    expect((await listCommunities({ commune: "Cocody" })).length).toBe(0); // privée → non listée
    await leaveCommunity(member.id, c.id);
    expect((await prisma.community.findUniqueOrThrow({ where: { id: c.id } })).memberCount).toBe(1);
  });
});

describe("livraison à domicile", () => {
  beforeEach(resetDb);

  it("mission livreur : attribution, refus, incident, livraison par code", async () => {
    const f = await baseFixture();
    const driverUser = await makeUser("DRIVER");
    const driver = await prisma.driver.create({ data: { userId: driverUser.id, vehicleType: "moto", communes: ["Cocody"] } });
    const user = await makeUser();
    await addToCart(user.id, { kind: "STOCK", variantId: f.variant.id, quantity: 2 });
    const order = await placeOrder(user.id, { fulfillmentMode: "HOME_DELIVERY", newAddress: { label: "Maison", commune: "Cocody", quartier: "Angré" }, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null);
    expect(order.deliveryFee).toBe(1_000 + 12 * 25); // base + distance
    await simulateMockPayment(user.id, (await initiatePayment(user.id, { orderId: order.id, method: "CARD", purpose: "ORDER" }, null)).paymentId, "PAID");
    await prepareStockItems(order.id, f.admin.id);
    expect((await logisticsBoard()).ready.map((o) => o.id)).toContain(order.id);
    const d = await prisma.delivery.findUniqueOrThrow({ where: { orderId: order.id } });

    await assignDriver(order.id, driver.id, f.admin.id);
    await driverRespond(driverUser.id, d.id, false); // refus → retour au pool
    expect((await prisma.delivery.findUniqueOrThrow({ where: { id: d.id } })).driverId).toBeNull();
    await assignDriver(order.id, driver.id, f.admin.id);
    await driverRespond(driverUser.id, d.id, true);
    await driverPickup(driverUser.id, d.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("OUT_FOR_DELIVERY");
    await reportIncident(driverUser.id, d.id, "Client absent au domicile");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("READY");

    await assignDriver(order.id, driver.id, f.admin.id);
    await driverRespond(driverUser.id, d.id, true);
    await driverPickup(driverUser.id, d.id);
    await expect(driverDeliver(driverUser.id, d.id, "123")).rejects.toThrow(/incorrect/);
    const code = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).pickupCode;
    await driverDeliver(driverUser.id, d.id, code);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("DELIVERED");
    const m = await driverMissions(driverUser.id);
    expect(m.earnings.deliveries).toBe(1);
    expect(m.earnings.total).toBeGreaterThan(0);
    await expect(reportIncident(driverUser.id, d.id, "trop tard")).rejects.toThrow(/terminée/);
  });

  it("refuse une livraison hors zone desservie", async () => {
    const f = await baseFixture();
    const user = await makeUser();
    await addToCart(user.id, { kind: "STOCK", variantId: f.variant.id, quantity: 1 });
    await expect(
      placeOrder(user.id, { fulfillmentMode: "HOME_DELIVERY", newAddress: { label: "M", commune: "Anyama", quartier: "Centre" }, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null),
    ).rejects.toThrow(/pas encore disponible/);
  });
});

describe("confidentialité, support, avis", () => {
  beforeEach(resetDb);

  it("consentements journalisés, export et suppression pseudonymisée", async () => {
    await baseFixture();
    const user = await makeUser();
    await setConsent(user.id, "MARKETING_SMS", true, "1.2.3.4");
    await setConsent(user.id, "MARKETING_SMS", false, "1.2.3.4");
    const c = await currentConsents(user.id);
    expect((c.latest as Record<string, { granted: boolean }>).MARKETING_SMS.granted).toBe(false);
    expect(c.history).toHaveLength(2);
    await expect(setConsent(user.id, "TERMS", false, null)).rejects.toThrow(/supprimez/);
    expect((await exportUserData(user.id)).data.phone).toBe(user.phone);
    await expect(deleteAccount(user.id, "mauvais")).rejects.toThrow(/incorrect/);
    await deleteAccount(user.id, "motdepasse1");
    const deleted = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(deleted.status).toBe("DELETED");
    expect(deleted.phone).not.toBe(user.phone);
    expect(deleted.firstName).toBe("Utilisateur supprimé");
    await expect(login(user.phone, "motdepasse1")).rejects.toThrow();
  });

  it("support et avis après livraison uniquement", async () => {
    const f = await baseFixture();
    const user = await makeUser();
    await addToCart(user.id, { kind: "STOCK", variantId: f.variant.id, quantity: 1 });
    const o = await placeOrder(user.id, pickup(f.pickupPoint.id), null);
    await createTicket(user.id, { category: "ORDER", subject: "Question", message: "Quand serai-je livré ?", orderId: o.id });
    expect(await listTickets(user.id)).toHaveLength(1);
    await expect(createReview(user.id, { orderId: o.id, target: "ORDER", rating: 5 })).rejects.toThrow(/après la livraison/);
    await prisma.order.update({ where: { id: o.id }, data: { status: "DELIVERED" } });
    await createReview(user.id, { orderId: o.id, target: "PRODUCT", productId: f.product.id, rating: 4 });
    await expect(createReview(user.id, { orderId: o.id, target: "PRODUCT", productId: f.product.id, rating: 4 })).rejects.toThrow(/déjà/);
  });
});

describe("fournisseur & administration", () => {
  beforeEach(resetDb);

  it("portail fournisseur : tableau de bord, tarifs journalisés, RFQ isolées", async () => {
    const f = await baseFixture();
    const d = await supplierDashboard(f.supplierUser.id);
    expect(d.products).toHaveLength(1);
    await updateSupplierProduct(f.supplierUser.id, f.supplierProduct.id, { capacityUnitsPerWeek: 300, leadTimeDays: 4, tiers: [{ minUnits: 1, unitPrice: 22_500 }, { minUnits: 50, unitPrice: 21_900 }] });
    expect(await prisma.priceTier.count({ where: { supplierProductId: f.supplierProduct.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "price.supplier.update" } })).toBe(1);
    await expect(updateSupplierProduct(f.supplierUser.id, f.supplierProduct.id, { capacityUnitsPerWeek: 1, leadTimeDays: 1, tiers: [{ minUnits: 1, unitPrice: 1 }, { minUnits: 2, unitPrice: 2 }] })).rejects.toThrow();
    await expect(supplierRfq(f.supplierUser.id, "inexistante")).rejects.toThrow(/introuvable/);
  });

  it("gestion des utilisateurs, permissions, KYB et indicateurs", async () => {
    const f = await baseFixture();
    const target = await makeUser();
    const session = await createSession(target.id);
    await setUserStatus(target.id, "SUSPENDED", f.admin.id);
    expect(await getUserBySessionToken(session.token)).toBeNull(); // sessions fermées
    await expect(setUserStatus(f.admin.id, "SUSPENDED", f.admin.id)).rejects.toThrow(/propre/);
    const ops = await makeUser("ADMIN");
    await setAdminPermissions(ops.id, ["ORDERS_MANAGE"], f.admin.id);
    await expect(setAdminPermissions(target.id, ["ORDERS_MANAGE"], f.admin.id)).rejects.toThrow(/administrateur/);
    await setSupplierVerification(f.supplier.id, "REJECTED", "Documents illisibles", f.admin.id);
    expect((await listSuppliers())[0].verificationStatus).toBe("REJECTED");
    expect((await listUsers({ q: target.firstName })).length).toBe(1);
    expect(await listOrdersAdmin({})).toHaveLength(0);
    const k = await dashboardKpis(30);
    expect(k.orders).toBe(0);
    expect(await dailySeries(7)).toHaveLength(7);
  });

  it("tâches planifiées, notifications, économies plateforme", async () => {
    const f = await baseFixture();
    const user = await makeUser();
    await addToCart(user.id, { kind: "GROUP_BUY", portionId: f.portion(5).id, quantity: 1 });
    await placeOrder(user.id, pickup(f.pickupPoint.id), null, prisma, new Date(Date.now() - 2 * 3_600_000));
    const res = await runScheduledJobs(prisma, new Date(Date.now() + 5 * DAY));
    expect(res.unpaidOrders).toBe(1); // commande non payée annulée, réservation libérée
    expect((await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } })).heldBase).toBe(0);
    expect(Array.isArray(res.deadlines)).toBe(true);
    await prisma.notification.create({ data: { userId: user.id, channel: "SMS", template: "x", title: "t", body: "b" } });
    expect(await dispatchQueuedNotifications()).toBe(1);
    await prisma.notification.create({ data: { userId: user.id, channel: "IN_APP", template: "x", title: "t", body: "b", status: "SENT" } });
    expect(await unreadCount(user.id)).toBe(1);
    await markAllRead(user.id);
    expect(await unreadCount(user.id)).toBe(0);
    expect((await listNotifications(user.id)).length).toBe(1);
    expect((await userSavings(user.id)).total).toBe(0);
    expect((await platformSavings()).households).toBe(0);
  });
});
