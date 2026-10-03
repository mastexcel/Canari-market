/**
 * Boucle MVP complète, contre une vraie base PostgreSQL :
 * inscription → achat groupé → commande → paiement simulé → agrégation →
 * clôture/paliers → RFQ → fournisseur → réception → fractionnement →
 * point relais → retrait par code → économies, marge et parrainage.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/infrastructure/db";
import { signup, login, createSession, getUserBySessionToken } from "@/application/auth.service";
import { addToCart, getCart } from "@/application/cart.service";
import { placeOrder, quoteCheckout, cancelOrder, getOrderForUser } from "@/application/order.service";
import { handlePaymentWebhook, initiatePayment, simulateMockPayment } from "@/application/payment.service";
import { closeGroupBuy, consolidatedDemand, getGroupBuyDetail, publishGroupBuy } from "@/application/group-buy.service";
import { awardRfq, confirmPurchaseOrder, createRfqFromGroupBuy, getRfqWithRanking, shipPurchaseOrder, submitRfqResponse } from "@/application/procurement.service";
import { lotLedger, receivePurchaseOrder, recordFractionation } from "@/application/inventory.service";
import { dispatchToPickupPoints, pickupHandover, pickupReceive } from "@/application/delivery.service";
import { userSavings } from "@/application/savings.service";
import { dashboardKpis } from "@/application/admin.service";
import { getMockProvider } from "@/infrastructure/payments/registry";
import { baseFixture, makeUser, resetDb } from "./helpers";

const DAY = 86_400_000;

async function household(name: string, phone: string, referralCode?: string) {
  return signup({
    firstName: name,
    lastName: "",
    phone,
    password: "motdepasse1",
    accountType: "HOUSEHOLD",
    commune: "Cocody",
    quartier: "Angré",
    adults: 2,
    children: 2,
    referralCode: referralCode ?? "",
    acceptTerms: true,
    marketingSms: false,
    marketingWhatsapp: false,
  });
}

async function buy(userId: string, portionId: string, quantity: number, pickupPointId: string) {
  await addToCart(userId, { kind: "GROUP_BUY", portionId, quantity });
  const order = await placeOrder(userId, { fulfillmentMode: "PICKUP", pickupPointId, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null);
  const pay = await initiatePayment(userId, { orderId: order.id, method: "MOBILE_MONEY", operator: "ORANGE_MONEY", payerPhone: "0707123456", purpose: "ORDER" }, null);
  return { order, pay };
}

describe("boucle MVP", () => {
  beforeEach(resetDb);

  it("de l'inscription à la livraison, avec économies et marge", async () => {
    const f = await baseFixture();

    // Inscription & connexion
    const awa = await household("Awa", "07 07 11 22 33");
    const awaLogin = await login("+2250707112233", "motdepasse1");
    expect(awaLogin.id).toBe(awa.id);
    const session = await createSession(awa.id);
    expect((await getUserBySessionToken(session.token))?.id).toBe(awa.id);
    await expect(login("0707112233", "mauvais1")).rejects.toThrow(/incorrect/);

    const kone = await household("Koné", "05 05 11 22 33", awa.referralCode);

    // L'achat groupé est visible avec sa progression
    const detail = await getGroupBuyDetail("riz-50kg", awa.id);
    expect(detail.progress.payableUnitPrice).toBe(25_500);
    expect(detail.portions.find((p) => p.quantityBase === 5_000)?.unitPrice).toBe(2_550);

    // Awa : 2 × 10 kg ; devis cohérent
    await addToCart(awa.id, { kind: "GROUP_BUY", portionId: f.portion(10).id, quantity: 2 });
    const cart = await getCart(awa.id);
    expect(cart.lines[0].lineTotal).toBe((5_100 + 150) * 2);
    const quote = await quoteCheckout(awa.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false });
    expect(quote.totals).toMatchObject({ subtotal: 10_200, fractionationFees: 300, deliveryFee: 200, total: 10_700 });
    expect(quote.totals.savings).toBe((5_500 - 5_250) * 2);

    const order = await placeOrder(awa.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, "idem-1");
    expect(order.status).toBe("PENDING_PAYMENT");
    // Idempotence : même clé → même commande
    const again = await placeOrder(awa.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, "idem-1");
    expect(again.id).toBe(order.id);
    expect((await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } })).heldBase).toBe(20_000);

    // Paiement simulé : un seul paiement en cours par commande
    const p1 = await initiatePayment(awa.id, { orderId: order.id, method: "MOBILE_MONEY", operator: "ORANGE_MONEY", payerPhone: "0707112233", purpose: "ORDER" }, null);
    const p2 = await initiatePayment(awa.id, { orderId: order.id, method: "MOBILE_MONEY", operator: "ORANGE_MONEY", payerPhone: "0707112233", purpose: "ORDER" }, null);
    expect(p2.paymentId).toBe(p1.paymentId);
    expect(p1.redirectUrl).toBe(`/paiement/${p1.paymentId}`);
    expect((await simulateMockPayment(awa.id, p1.paymentId, "PAID")).status).toBe("applied");

    let gb = await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } });
    expect(gb).toMatchObject({ committedBase: 20_000, heldBase: 0, participantCount: 1 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("GROUP_PENDING");
    await expect(initiatePayment(awa.id, { orderId: order.id, method: "CARD", purpose: "ORDER" }, null)).rejects.toThrow(/déjà réglée/);

    // Webhook : signature invalide refusée, rejeu dédupliqué
    const mock = getMockProvider();
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: p1.paymentId } });
    const hook = mock.buildWebhook({ reference: payment.providerRef!, status: "PAID", amount: payment.amount });
    const tampered = new Headers(hook.headers);
    tampered.set("x-canari-signature", hook.headers.get("x-canari-signature")!.replace(/v1=./, "v1=0"));
    await expect(handlePaymentWebhook("mock", hook.body, tampered)).rejects.toThrow(/refusé/);
    expect((await handlePaymentWebhook("mock", hook.body, hook.headers)).status).toBe("duplicate");
    expect((await handlePaymentWebhook("mock", hook.body, hook.headers)).status).toBe("duplicate");

    // Koné : 3 sacs de 50 kg → 3,4 sacs : palier 2 atteint (25 500), objectif 4 non atteint
    const k = await buy(kone.id, f.portion(50).id, 3, f.pickupPoint.id);
    await simulateMockPayment(kone.id, k.pay.paymentId, "PAID");
    // Un 3e ménage fait passer l'objectif : 4 sacs → 24 500
    const third = await household("Fanta", "01 01 11 22 33");
    const t = await buy(third.id, f.portion(10).id, 3, f.pickupPoint.id);
    await simulateMockPayment(third.id, t.pay.paymentId, "PAID");
    gb = await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } });
    expect(gb.committedBase).toBe(200_000);

    // Clôture : prix final 24 500, différence remboursée automatiquement
    const closed = await closeGroupBuy(f.groupBuy.id, f.admin.id, { force: "success" });
    expect(closed).toMatchObject({ action: "CLOSE_SUCCESS", finalUnitPrice: 24_500 });
    const awaRefunds = await prisma.refund.findMany({ where: { orderId: order.id } });
    expect(awaRefunds.map((r) => [r.amount, r.status, r.reason])).toEqual([[400, "SUCCEEDED", "TIER_PRICE_DIFFERENCE"]]);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p1.paymentId } })).status).toBe("PARTIALLY_REFUNDED");
    const konesRefund = await prisma.refund.aggregate({ where: { orderId: k.order.id }, _sum: { amount: true } });
    expect(konesRefund._sum.amount).toBe(3_000);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("GROUP_CONFIRMED");

    // Demande consolidée : 200 kg → 4 sacs à commander (+ pertes sur le reconditionné)
    const demand = await consolidatedDemand(f.groupBuy.id);
    expect(demand.demand.totalBase).toBe(200_000);
    expect(demand.demand.supplierUnitsToOrder).toBe(5); // 50 kg reconditionnés + 1 % de pertes → 5e sac entamé
    expect(demand.plan.fullUnitsShippedAsIs).toBe(3);
    expect(demand.economics.grossMargin).toBeGreaterThan(0);

    // RFQ → offre fournisseur → classement → attribution
    const rfq = await createRfqFromGroupBuy(
      f.groupBuy.id,
      { quality: "Grade A", packaging: "Sacs 50 kg", destination: "Entrepôt Yopougon", neededBy: new Date(Date.now() + 5 * DAY), closesAt: new Date(Date.now() + DAY) },
      f.admin.id,
    );
    expect(rfq.quantityBase).toBe(250_000);
    await submitRfqResponse(f.supplierUser.id, rfq.id, { unitPrice: 22_000, unitsOffered: 10, leadTimeDays: 2, deliveryLocation: "Yopougon", validUntil: new Date(Date.now() + 3 * DAY) });
    const { ranked } = await getRfqWithRanking(rfq.id);
    expect(ranked).toHaveLength(1);
    const po = await awardRfq(rfq.id, ranked[0].responseId, null, f.admin.id);
    expect(po.totalAmount).toBe(5 * 22_000);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SUPPLIER_ORDERED");

    // Fournisseur confirme et expédie ; CANARI réceptionne (avec 1 kg d'avarie)
    await confirmPurchaseOrder(f.supplierUser.id, po.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("SUPPLIER_CONFIRMED");
    await shipPurchaseOrder(f.supplierUser.id, po.id);
    await receivePurchaseOrder(po.id, { receivedUnits: 5, damagedBase: 1_000 }, f.admin.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("RECEIVED_WAREHOUSE");

    // Fractionnement : 3 sacs remis tels quels + 50 kg en portions de 10 kg
    await expect(recordFractionation(f.groupBuy.id, { portionBase: 10_000, portionCount: 30, lossBase: 0 }, f.admin.id)).rejects.toThrow(/insuffisant/);
    await recordFractionation(f.groupBuy.id, { portionBase: 50_000, portionCount: 3, lossBase: 0 }, f.admin.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PACKING");
    const ledgerAfter = await recordFractionation(f.groupBuy.id, { portionBase: 10_000, portionCount: 5, lossBase: 300 }, f.admin.id);
    expect(ledgerAfter.toPrepareBase).toBe(0);
    expect(ledgerAfter.lossBase).toBe(1_300);
    expect(ledgerAfter.bulkRemainingBase).toBe(250_000 - 200_000 - 1_300);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("READY");

    // Point relais : expédition, réception, retrait par code
    await dispatchToPickupPoints([order.id], f.admin.id);
    await pickupReceive(f.pickupManager.id, order.number);
    const ready = await getOrderForUser(awa.id, order.id);
    expect(ready.status).toBe("READY_FOR_PICKUP");
    await expect(pickupHandover(f.pickupManager.id, order.number, "000000")).rejects.toThrow(/incorrect/);
    await pickupHandover(f.pickupManager.id, order.number, ready.pickupCode);
    const delivered = await getOrderForUser(awa.id, order.id);
    expect(delivered.status).toBe("DELIVERED");
    expect(delivered.timeline.every((s) => s.state === "done")).toBe(true);

    // Économies réelles : (5 500 − 4 900 − 150) × 2 = 900 F
    expect(delivered.savingsTotal).toBe(900);
    const s = await userSavings(awa.id);
    expect(s.total).toBe(900);
    expect(s.thisMonth).toBe(900);

    // Grand livre : livré, stock
    const { ledger } = await lotLedger(f.groupBuy.id);
    expect(ledger.dispatchedBase).toBe(20_000);

    // Parrainage : Koné n'est pas livré → Awa n'est pas encore récompensée
    expect(await prisma.creditLedgerEntry.count({ where: { userId: awa.id } })).toBe(0);

    // Indicateurs admin
    const kpis = await dashboardKpis(30);
    expect(kpis.orders).toBe(3);
    expect(kpis.savings).toBeGreaterThan(0);
    expect(kpis.grossMargin).toBeGreaterThan(0);
    expect(kpis.funnel.find((x) => x.step === "payment_completed")?.users).toBe(3);
  });

  it("parrainage récompensé à la première livraison du filleul uniquement", async () => {
    const f = await baseFixture();
    const parrain = await household("Parrain", "07 07 00 00 01");
    const filleul = await household("Filleul", "07 07 00 00 02", parrain.referralCode);
    await addToCart(filleul.id, { kind: "STOCK", variantId: f.variant.id, quantity: 3 });
    const order = await placeOrder(filleul.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null);
    const pay = await initiatePayment(filleul.id, { orderId: order.id, method: "CARD", purpose: "ORDER" }, null);
    await simulateMockPayment(filleul.id, pay.paymentId, "PAID");
    const { prepareStockItems } = await import("@/application/inventory.service");
    await prepareStockItems(order.id, f.admin.id);
    await dispatchToPickupPoints([order.id], f.admin.id);
    await pickupReceive(f.pickupManager.id, order.number);
    await pickupHandover(f.pickupManager.id, order.number, (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).pickupCode);
    const credits = await prisma.creditLedgerEntry.findMany({ where: { reason: "REFERRAL_REWARD" } });
    expect(credits.map((c) => c.amount).sort()).toEqual([500, 500]);
    expect((await prisma.referral.findUniqueOrThrow({ where: { refereeId: filleul.id } })).status).toBe("REWARDED");
    // Stock : 15 kg sortis
    expect((await prisma.inventory.findFirstOrThrow({ where: { productId: f.product.id } })).quantityBase).toBe(85_000);
  });
});

describe("règles d'échec et garde-fous", () => {
  beforeEach(resetDb);

  it("rembourse intégralement, ou crédite un avoir seulement avec accord", async () => {
    const f = await baseFixture({ failurePolicy: "CREDIT_WITH_CONSENT" });
    const a = await household("A", "07 07 00 00 11");
    const b = await household("B", "07 07 00 00 12");
    await addToCart(a.id, { kind: "GROUP_BUY", portionId: f.portion(5).id, quantity: 1 });
    const oa = await placeOrder(a.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: true }, null);
    await simulateMockPayment(a.id, (await initiatePayment(a.id, { orderId: oa.id, method: "CARD", purpose: "ORDER" }, null)).paymentId, "PAID");
    const ob = (await buy(b.id, f.portion(5).id, 1, f.pickupPoint.id));
    await simulateMockPayment(b.id, ob.pay.paymentId, "PAID");

    const res = await closeGroupBuy(f.groupBuy.id, null, {}, prisma, new Date(Date.now() + 4 * DAY));
    expect(res).toMatchObject({ action: "CLOSE_FAILED", policy: "CREDIT_WITH_CONSENT" });

    // A a consenti : avoir de 2 550 + 150 ; frais de point relais remboursés
    expect((await prisma.creditLedgerEntry.aggregate({ where: { userId: a.id }, _sum: { amount: true } }))._sum.amount).toBe(2_700);
    // B n'a pas consenti : remboursement intégral (produit + fractionnement + frais)
    const refundB = await prisma.refund.aggregate({ where: { orderId: ob.order.id }, _sum: { amount: true } });
    expect(refundB._sum.amount).toBe(2_700 + 200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ob.order.id } })).status).toBe("REFUNDED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: ob.pay.paymentId } })).status).toBe("REFUNDED");
  });

  it("prolonge selon la règle EXTEND", async () => {
    const f = await baseFixture({ failurePolicy: "EXTEND" });
    const res = await closeGroupBuy(f.groupBuy.id, null, {}, prisma, new Date(Date.now() + 4 * DAY));
    expect(res.action).toBe("EXTEND");
    const gb = await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } });
    expect(gb.status).toBe("OPEN");
    expect(gb.extensionsUsed).toBe(1);
  });

  it("propose un prix alternatif ; l'acceptation passe par un supplément, le refus rembourse", async () => {
    const f = await baseFixture({ failurePolicy: "ALTERNATIVE_PRICE" });
    const a = await household("A", "07 07 00 00 21");
    const o = await buy(a.id, f.portion(10).id, 1, f.pickupPoint.id);
    await simulateMockPayment(a.id, o.pay.paymentId, "PAID");
    await closeGroupBuy(f.groupBuy.id, null, {}, prisma, new Date(Date.now() + 4 * DAY));
    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: o.order.id }, include: { participant: true } });
    expect(item.participant?.status).toBe("AWAITING_DECISION");
    // Accepter : supplément (26 000 − 25 500) × 10/50 = 100 F
    const sup = await initiatePayment(a.id, { orderId: o.order.id, method: "CARD", purpose: "SUPPLEMENT", orderItemId: item.id }, null);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: sup.paymentId } })).amount).toBe(100);
    await simulateMockPayment(a.id, sup.paymentId, "PAID");
    const after = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id }, include: { participant: true } });
    expect(after.participant?.status).toBe("CONFIRMED");
    expect(after.status).toBe("GROUP_CONFIRMED");
    expect(after.finalUnitPrice).toBe(5_200);

    // Un second participant refuse : remboursement intégral (produit + fractionnement + frais de retrait)
    const { declineAlternative } = await import("@/application/group-buy.service");
    const b = await household("B", "07 07 00 00 22");
    await prisma.groupBuy.update({ where: { id: f.groupBuy.id }, data: { status: "OPEN", closesAt: new Date(Date.now() + DAY) } });
    const ob = await buy(b.id, f.portion(5).id, 1, f.pickupPoint.id);
    await simulateMockPayment(b.id, ob.pay.paymentId, "PAID");
    await prisma.groupBuyParticipant.updateMany({ where: { userId: b.id }, data: { status: "AWAITING_DECISION" } });
    const itemB = await prisma.orderItem.findFirstOrThrow({ where: { orderId: ob.order.id } });
    await declineAlternative(b.id, itemB.id);
    expect((await prisma.refund.aggregate({ where: { orderId: ob.order.id }, _sum: { amount: true } }))._sum.amount).toBe(2_550 + 150 + 200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: ob.order.id } })).status).toBe("REFUNDED");
  });

  it("refuse le dépassement de capacité et l'annulation libère la réservation", async () => {
    const f = await baseFixture({ maxUnits: 2 });
    const a = await household("A", "07 07 00 00 31");
    const b = await household("B", "07 07 00 00 32");
    await addToCart(a.id, { kind: "GROUP_BUY", portionId: f.portion(50).id, quantity: 2 });
    const oa = await placeOrder(a.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null);
    await addToCart(b.id, { kind: "GROUP_BUY", portionId: f.portion(5).id, quantity: 1 });
    await expect(
      placeOrder(b.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null),
    ).rejects.toThrow(/capacité/);
    await cancelOrder(a.id, oa.id);
    const gb = await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } });
    expect(gb.heldBase).toBe(0);
    await expect(
      placeOrder(b.id, { fulfillmentMode: "PICKUP", pickupPointId: f.pickupPoint.id, deliverySpeed: "STANDARD", useCredit: false, creditConsent: false }, null),
    ).resolves.toBeTruthy();
  });

  it("annule et rembourse une commande payée tant que l'achat est ouvert", async () => {
    const f = await baseFixture();
    const a = await household("A", "07 07 00 00 41");
    const o = await buy(a.id, f.portion(10).id, 1, f.pickupPoint.id);
    await simulateMockPayment(a.id, o.pay.paymentId, "PAID");
    await cancelOrder(a.id, o.order.id);
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.paymentId } })).status).toBe("REFUNDED");
    expect((await prisma.groupBuy.findUniqueOrThrow({ where: { id: f.groupBuy.id } })).committedBase).toBe(0);
  });

  it("un paiement échoué laisse la commande payable", async () => {
    const f = await baseFixture();
    const a = await household("A", "07 07 00 00 51");
    const o = await buy(a.id, f.portion(5).id, 1, f.pickupPoint.id);
    await simulateMockPayment(a.id, o.pay.paymentId, "FAILED");
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.order.id } })).status).toBe("PENDING_PAYMENT");
    // Un « PAID » tardif sur un paiement échoué est ignoré
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: o.pay.paymentId } });
    const hook = getMockProvider().buildWebhook({ reference: p.providerRef!, status: "PAID", amount: p.amount });
    expect((await handlePaymentWebhook("mock", hook.body, hook.headers)).status).toBe("ignored");
    const retry = await initiatePayment(a.id, { orderId: o.order.id, method: "CARD", purpose: "ORDER" }, null);
    expect(retry.paymentId).not.toBe(o.pay.paymentId);
  });

  it("bloque la publication d'une campagne déficitaire sans acquittement motivé", async () => {
    const f = await baseFixture();
    const draft = await prisma.groupBuy.update({
      where: { id: f.groupBuy.id },
      data: { status: "DRAFT", supplierUnitCost: 26_000 },
    });
    const admin = await makeUser("ADMIN");
    await expect(publishGroupBuy(draft.id, admin.id)).rejects.toThrow(/déficitaire/);
    await expect(publishGroupBuy(draft.id, admin.id, { acknowledgeDeficit: true, reason: "court" })).rejects.toThrow();
    const ok = await publishGroupBuy(draft.id, admin.id, { acknowledgeDeficit: true, reason: "Campagne d'acquisition validée par la direction" });
    expect(ok.status).toBe("OPEN");
    expect(await prisma.auditLog.count({ where: { action: "groupbuy.publish", entityId: draft.id } })).toBe(1);
  });
});
