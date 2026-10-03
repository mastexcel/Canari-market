import { describe, expect, it } from "vitest";
import { assessCampaign, computeUnitEconomics, type CampaignCosts } from "@/domain/unit-economics";
import { computeCheckoutTotals } from "@/domain/checkout";
import { lineSavings, orderSavings, summarizeSavings } from "@/domain/savings";
import { referenceFreshness, usableReferencePrice, latestReference } from "@/domain/reference-price";

const COSTS: CampaignCosts = {
  supplierUnitQuantityBase: 50_000,
  supplierUnitCost: 22_000,
  inboundTransportPerUnit: 400,
  storagePerUnit: 150,
  fractionationFeePerPortion: 150,
  fractionationCostPerPortion: 60,
  packagingCostPerPortion: 40,
  lossRateBps: 100,
  paymentFeeBps: 150,
  deliveryCostPerOrder: 50,
  promotionCostPerUnit: 0,
  expectedAvgPortionBase: 10_000,
};

describe("économie unitaire", () => {
  it("calcule chaque poste et la marge nette", () => {
    const e = computeUnitEconomics({ ...COSTS, units: 200, customerUnitPrice: 24_500 });
    expect(e.portions).toBe(1_000);
    expect(e.revenueProducts).toBe(4_900_000);
    expect(e.revenueFractionation).toBe(150_000);
    expect(e.revenue).toBe(5_050_000);
    expect(e.supplierCost).toBe(4_400_000);
    expect(e.inboundTransport).toBe(80_000);
    expect(e.lossCost).toBe(44_800); // 2 sacs perdus × (22 000 + 400)
    expect(e.grossMargin).toBe(5_050_000 - 4_400_000 - 80_000 - 44_800);
    expect(e.storage).toBe(30_300);
    expect(e.fractionation).toBe(60_000);
    expect(e.packaging).toBe(40_000);
    expect(e.paymentFees).toBe(75_750);
    expect(e.delivery).toBe(50_000);
    expect(e.netMargin).toBe(e.grossMargin - 30_300 - 60_000 - 40_000 - 75_750 - 50_000);
    expect(e.netMargin).toBeGreaterThan(0);
  });

  it("ne compte ni fractionnement ni pertes si la demande est en sacs entiers", () => {
    const e = computeUnitEconomics({ ...COSTS, expectedAvgPortionBase: 50_000, units: 10, customerUnitPrice: 24_500 });
    expect(e.revenueFractionation).toBe(0);
    expect(e.lossCost).toBe(0);
    expect(e.fractionation).toBe(0);
  });

  it("bloque une campagne déficitaire et signale l'absence d'économie client", () => {
    const a = assessCampaign(
      COSTS,
      [
        { minUnits: 50, unitPrice: 26_500 },
        { minUnits: 200, unitPrice: 22_100 },
      ],
      26_000,
      true,
    );
    expect(a.requiresAcknowledgement).toBe(true);
    expect(a.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["NO_CUSTOMER_SAVING", "NET_DEFICIT"]));
  });

  it("accepte une campagne saine", () => {
    const a = assessCampaign(COSTS, [{ minUnits: 50, unitPrice: 25_500 }, { minUnits: 200, unitPrice: 24_500 }], 27_500, true);
    expect(a.requiresAcknowledgement).toBe(false);
    expect(a.scenarios).toHaveLength(2);
  });

  it("bloque un prix de référence périmé", () => {
    const a = assessCampaign(COSTS, [{ minUnits: 50, unitPrice: 25_500 }], 27_500, false);
    expect(a.warnings.some((w) => w.code === "STALE_REFERENCE" && w.severity === "blocking")).toBe(true);
  });
});

describe("récapitulatif de commande", () => {
  const now = new Date("2026-10-03T10:00:00Z");
  const lines = [
    { quantity: 2, unitPrice: 4_900, referenceUnitPrice: 5_500, fractionationFee: 150 },
    { quantity: 1, unitPrice: 1_200, referenceUnitPrice: 1_400, fractionationFee: 0 },
  ];

  it("calcule sous-total, économie, fractionnement, livraison et total", () => {
    const t = computeCheckoutTotals({ lines, deliveryFee: 500, now });
    expect(t.subtotal).toBe(11_000);
    expect(t.fractionationFees).toBe(300);
    expect(t.referenceTotal).toBe(12_400);
    expect(t.savings).toBe(900 + 200);
    expect(t.total).toBe(11_800);
    expect(t.savingsBps).toBe(887);
  });

  const promo = {
    value: 10,
    minOrder: 5_000,
    startsAt: new Date("2026-01-01"),
    endsAt: new Date("2026-12-31"),
    isActive: true,
    maxUses: 100,
    usedCount: 0,
  };

  it("applique promotions et avoir", () => {
    expect(computeCheckoutTotals({ lines, deliveryFee: 500, now, promotion: { ...promo, type: "PERCENT" } }).discount).toBe(1_100);
    expect(computeCheckoutTotals({ lines, deliveryFee: 500, now, promotion: { ...promo, type: "FREE_DELIVERY" } }).total).toBe(11_300);
    const withCredit = computeCheckoutTotals({ lines, deliveryFee: 500, now, availableCredit: 2_000, useCredit: true });
    expect(withCredit.creditApplied).toBe(2_000);
    expect(withCredit.total).toBe(9_800);
    expect(computeCheckoutTotals({ lines, deliveryFee: 0, now, availableCredit: 99_999, useCredit: true }).total).toBe(0);
  });

  it("refuse promotions invalides et panier vide", () => {
    expect(() =>
      computeCheckoutTotals({ lines, deliveryFee: 0, now, promotion: { ...promo, type: "FIXED", minOrder: 50_000 } }),
    ).toThrow(/minimum/);
    expect(() =>
      computeCheckoutTotals({ lines, deliveryFee: 0, now, promotion: { ...promo, type: "FIXED", usedCount: 100 } }),
    ).toThrow(/maximal/);
    expect(() =>
      computeCheckoutTotals({ lines, deliveryFee: 0, now, promotion: { ...promo, type: "FIXED", isActive: false } }),
    ).toThrow();
    expect(() => computeCheckoutTotals({ lines: [], deliveryFee: 0, now })).toThrow(/vide/);
  });
});

describe("économies", () => {
  it("compte le prix final et les frais, jamais négatif", () => {
    expect(lineSavings({ quantity: 2, referenceUnitPrice: 5_500, unitPrice: 5_100, finalUnitPrice: 4_900, fractionationFee: 150 })).toBe(900);
    expect(lineSavings({ quantity: 1, referenceUnitPrice: 1_000, unitPrice: 1_200, fractionationFee: 0 })).toBe(0);
    expect(orderSavings([])).toBe(0);
  });

  it("synthétise par mois", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const s = summarizeSavings(
      [
        { date: new Date("2026-10-02"), amount: 3_250 },
        { date: new Date("2026-10-10"), amount: 9_550 },
        { date: new Date("2026-08-10"), amount: 1_000 },
        { date: new Date("2025-01-10"), amount: 33_850 },
      ],
      now,
    );
    expect(s.thisMonth).toBe(12_800);
    expect(s.total).toBe(47_650);
    expect(s.byMonth).toHaveLength(6);
    expect(s.byMonth.at(-1)).toEqual({ month: "2026-10", amount: 12_800 });
  });
});

describe("prix de référence", () => {
  const now = new Date("2026-10-03T00:00:00Z");
  it("rejette un prix périmé ou futur", () => {
    const ref = { price: 27_500, source: "Relevé", method: "Médiane", observedAt: new Date("2026-09-20") };
    expect(referenceFreshness(ref.observedAt, now)).toBe("fresh");
    expect(usableReferencePrice(ref, now)).toBe(27_500);
    expect(usableReferencePrice({ ...ref, observedAt: new Date("2026-08-01") }, now)).toBeNull();
    expect(usableReferencePrice({ ...ref, observedAt: new Date("2026-11-01") }, now)).toBeNull();
  });
  it("prend le relevé le plus récent", () => {
    expect(latestReference([{ observedAt: new Date("2026-01-01") }, { observedAt: new Date("2026-02-01") }])?.observedAt).toEqual(
      new Date("2026-02-01"),
    );
    expect(latestReference([])).toBeNull();
  });
});
