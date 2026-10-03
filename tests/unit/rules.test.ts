import { describe, expect, it } from "vitest";
import { assertTransition, buildTimeline, canTransition, deriveOrderStatus } from "@/domain/order-status";
import { decidePaymentEvent, maskPhone, refundableAmount, statusAfterRefund } from "@/domain/payment";
import { computeHomeDeliveryFee, computePickupFee, generateSlots, isValidSlot } from "@/domain/delivery";
import { assertAwardDecision, rankOffers } from "@/domain/rfq";
import { evaluateReferral } from "@/domain/referral";
import { communityLevel, nextCommunityLevel, slugify } from "@/domain/community";
import { canPurchase, hasPermission, homePathFor } from "@/domain/permissions";
import { formatPhone, guessOperator, normalizeIvorianPhone } from "@/domain/phone";

describe("statuts de commande", () => {
  it("dérive le statut de la ligne la moins avancée", () => {
    expect(deriveOrderStatus(["GROUP_PENDING", "RECEIVED_WAREHOUSE"])).toBe("GROUP_PENDING");
    expect(deriveOrderStatus(["READY", "REFUNDED"])).toBe("READY");
    expect(deriveOrderStatus(["REFUNDED", "CANCELLED"])).toBe("REFUNDED");
    expect(deriveOrderStatus(["CANCELLED"])).toBe("CANCELLED");
    expect(deriveOrderStatus([])).toBe("DRAFT");
  });
  it("contrôle les transitions", () => {
    expect(canTransition("PENDING_PAYMENT", "GROUP_PENDING")).toBe(true);
    expect(canTransition("DELIVERED", "PACKING")).toBe(false);
    expect(() => assertTransition("CANCELLED", "PAID")).toThrow(/interdite/);
  });
  it("construit une frise adaptée au mode", () => {
    const t = buildTimeline("PACKING", { mode: "PICKUP", hasGroupItems: true });
    expect(t.map((s) => s.status)).toContain("READY_FOR_PICKUP");
    expect(t.find((s) => s.status === "PACKING")?.state).toBe("current");
    expect(t.find((s) => s.status === "PAID")?.state).toBe("done");
    expect(t.find((s) => s.status === "DELIVERED")?.state).toBe("upcoming");
    const stock = buildTimeline("DELIVERED", { mode: "HOME_DELIVERY", hasGroupItems: false });
    expect(stock.some((s) => s.status === "GROUP_PENDING")).toBe(false);
    expect(stock.every((s) => s.state === "done")).toBe(true);
    expect(buildTimeline("REFUNDED", { mode: "PICKUP", hasGroupItems: true }).at(-1)?.status).toBe("REFUNDED");
  });
});

describe("paiements", () => {
  it("traite les webhooks de façon idempotente", () => {
    expect(decidePaymentEvent("PENDING", "PAID")).toBe("APPLY");
    expect(decidePaymentEvent("PAID", "PAID")).toBe("IGNORE_DUPLICATE");
    expect(decidePaymentEvent("PAID", "FAILED")).toBe("IGNORE_STALE");
    expect(decidePaymentEvent("FAILED", "PAID")).toBe("IGNORE_STALE");
  });
  it("calcule les remboursements partiels et totaux", () => {
    const p = { amount: 10_000, refundedAmount: 0, status: "PAID" as const };
    expect(refundableAmount(p)).toBe(10_000);
    expect(statusAfterRefund(p, 4_000)).toEqual({ status: "PARTIALLY_REFUNDED", refundedAmount: 4_000 });
    expect(statusAfterRefund({ ...p, refundedAmount: 4_000, status: "PARTIALLY_REFUNDED" }, 6_000)).toEqual({
      status: "REFUNDED",
      refundedAmount: 10_000,
    });
    expect(() => statusAfterRefund(p, 10_001)).toThrow(/supérieur/);
    expect(refundableAmount({ ...p, status: "PENDING" as never })).toBe(0);
  });
  it("masque le numéro du payeur", () => {
    expect(maskPhone("+2250707123456")).toBe("+225 07 •• •• 34 56");
  });
});

describe("livraison", () => {
  const zone = { baseFee: 1_000, includedWeightKg: 10, perKgFee: 50, distanceKm: 12, perKmFee: 25, scheduledSurcharge: 500 };
  it("tarife selon poids, distance, encombrement et créneau", () => {
    const f = computeHomeDeliveryFee(zone, { weightGrams: 60_000, bulkyItems: 1, speed: "SCHEDULED" });
    expect(f).toMatchObject({ base: 1_000, weight: 2_500, distance: 300, bulky: 200, scheduled: 500, total: 4_500 });
    const discounted = computeHomeDeliveryFee(zone, { weightGrams: 1_000, bulkyItems: 0, speed: "STANDARD" }, {
      pickupFeeWaived: true,
      homeDiscountBps: 2_500,
    });
    expect(discounted.total).toBe(975);
    expect(computePickupFee(200).total).toBe(200);
    expect(computePickupFee(200, { pickupFeeWaived: true, homeDiscountBps: 0 }).total).toBe(0);
  });
  it("génère des créneaux sans dimanche, après la date de disponibilité", () => {
    const ready = new Date("2026-10-03T13:00:00Z"); // samedi
    const slots = generateSlots(ready, 3);
    expect(slots).toHaveLength(6);
    expect(slots[0].start.toISOString()).toBe("2026-10-03T14:00:00.000Z");
    expect(slots.every((s) => s.start.getUTCDay() !== 0)).toBe(true);
    expect(isValidSlot(ready, slots[1].start, slots[1].end)).toBe(true);
    expect(isValidSlot(ready, new Date("2026-10-03T08:00:00Z"), new Date("2026-10-03T12:00:00Z"))).toBe(false);
  });
});

describe("RFQ", () => {
  const offers = [
    { responseId: "cheap", supplierName: "A", unitPrice: 20_000, unitsOffered: 300, leadTimeDays: 10, qualityScore: 50, reliabilityScore: 40, onTimeRateBps: 5_000, supplierVerified: true },
    { responseId: "solid", supplierName: "B", unitPrice: 21_000, unitsOffered: 300, leadTimeDays: 5, qualityScore: 90, reliabilityScore: 92, onTimeRateBps: 9_500, supplierVerified: true },
    { responseId: "unverified", supplierName: "C", unitPrice: 19_000, unitsOffered: 300, leadTimeDays: 3, qualityScore: 95, reliabilityScore: 95, onTimeRateBps: 9_900, supplierVerified: false },
  ];
  it("ne classe pas uniquement sur le prix", () => {
    const ranked = rankOffers(offers, 250, 7);
    expect(ranked[0].responseId).toBe("solid");
    expect(ranked.at(-1)?.responseId).toBe("unverified");
    expect(ranked.find((r) => r.responseId === "cheap")?.flags).toEqual(
      expect.arrayContaining(["Moins cher mais fiabilité faible", "Qualité historique insuffisante"]),
    );
  });
  it("exige une justification hors meilleure offre et refuse un non vérifié", () => {
    const ranked = rankOffers(offers, 250, 7);
    expect(() => assertAwardDecision(ranked, "solid")).not.toThrow();
    expect(() => assertAwardDecision(ranked, "cheap")).toThrow(/justification/);
    expect(() => assertAwardDecision(ranked, "cheap", "Fournisseur local, audit qualité OK le 01/10")).not.toThrow();
    expect(() => assertAwardDecision(ranked, "unverified", "x".repeat(30))).toThrow(/non vérifié/);
    expect(rankOffers([], 10, 5)).toEqual([]);
  });
});

describe("parrainage non pyramidal", () => {
  const base = {
    referrerId: "a",
    refereeId: "b",
    referralStatus: "PENDING" as const,
    order: { status: "DELIVERED", total: 12_000, refundedAmount: 0, isFirstDeliveredOrder: true },
    referrerRewardsThisMonth: 0,
  };
  it("récompense uniquement une vraie première commande livrée", () => {
    expect(evaluateReferral(base)).toEqual({ qualifies: true, referrerReward: 500, refereeReward: 500 });
    expect(evaluateReferral({ ...base, order: { ...base.order, status: "PAID" } }).qualifies).toBe(false);
    expect(evaluateReferral({ ...base, order: { ...base.order, refundedAmount: 8_000 } }).qualifies).toBe(false);
    expect(evaluateReferral({ ...base, referrerRewardsThisMonth: 10 }).qualifies).toBe(false);
    expect(evaluateReferral({ ...base, refereeId: "a" }).qualifies).toBe(false);
    expect(evaluateReferral({ ...base, referralStatus: "REWARDED" }).qualifies).toBe(false);
  });
});

describe("communautés, permissions, téléphone", () => {
  it("attribue les niveaux de communauté", () => {
    expect(communityLevel(0).key).toBe("STARTER");
    expect(communityLevel(35).key).toBe("ARGENT");
    expect(nextCommunityLevel(35)).toMatchObject({ remainingOrders: 25 });
    expect(nextCommunityLevel(100)).toBeNull();
    expect(slugify("CANARI Angré 8e Tranche !")).toBe("canari-angre-8e-tranche");
  });
  it("applique le RBAC", () => {
    const admin = { id: "1", role: "ADMIN" as const, adminPermissions: ["ORDERS_MANAGE" as const] };
    expect(hasPermission(admin, "ORDERS_MANAGE")).toBe(true);
    expect(hasPermission(admin, "PRICING_MANAGE")).toBe(false);
    expect(hasPermission({ ...admin, adminPermissions: ["SUPER_ADMIN"] }, "PRICING_MANAGE")).toBe(true);
    expect(hasPermission({ ...admin, status: "SUSPENDED" }, "ORDERS_MANAGE")).toBe(false);
    expect(hasPermission({ id: "2", role: "SUPPLIER", adminPermissions: ["SUPER_ADMIN"] }, "ORDERS_MANAGE")).toBe(false);
    expect(canPurchase({ id: "3", role: "DRIVER", adminPermissions: [] })).toBe(false);
    expect(canPurchase({ id: "3", role: "HOUSEHOLD", adminPermissions: [] })).toBe(true);
    expect(homePathFor("SUPPLIER")).toBe("/fournisseur");
  });
  it("normalise les numéros ivoiriens", () => {
    expect(normalizeIvorianPhone("07 07 12 34 56")).toBe("+2250707123456");
    expect(normalizeIvorianPhone("+225 05-05-12-34-56")).toBe("+2250505123456");
    expect(normalizeIvorianPhone("002250101123456")).toBe("+2250101123456");
    expect(() => normalizeIvorianPhone("0907123456")).toThrow(/invalide/);
    expect(() => normalizeIvorianPhone("12345")).toThrow();
    expect(formatPhone("+2250707123456")).toBe("+225 07 07 12 34 56");
    expect(guessOperator("+2250707123456")).toBe("ORANGE_MONEY");
    expect(guessOperator("+2252720000000")).toBeNull();
  });
});
