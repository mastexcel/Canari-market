import { describe, expect, it } from "vitest";
import {
  alternativePriceSupplement,
  assertCanJoin,
  computeProgress,
  describeFailurePolicy,
  estimateOrdersNeeded,
  evaluateDeadline,
  settleFailure,
  settleSuccess,
  type GroupBuyState,
} from "@/domain/group-buy";

const SACK = 50_000;
const TIERS = [
  { minUnits: 50, unitPrice: 26_500 },
  { minUnits: 100, unitPrice: 25_500 },
  { minUnits: 200, unitPrice: 24_500 },
  { minUnits: 500, unitPrice: 23_800 },
];
const now = new Date("2026-10-03T10:00:00Z");

function gb(over: Partial<GroupBuyState> = {}): GroupBuyState {
  return {
    status: "OPEN",
    supplierUnitQuantityBase: SACK,
    targetUnits: 200,
    maxUnits: 600,
    committedBase: 173 * SACK,
    heldBase: 0,
    participantCount: 400,
    tiers: TIERS,
    opensAt: new Date("2026-09-25T00:00:00Z"),
    closesAt: new Date("2026-10-10T00:00:00Z"),
    failurePolicy: "REFUND",
    extensionsUsed: 0,
    maxExtensions: 1,
    extensionDays: 3,
    ...over,
  };
}

describe("progression d'un achat groupé (exemple du riz)", () => {
  it("reproduit l'exemple de la spécification : 173/200 → 86,5 %, encore 27", () => {
    const p = computeProgress(gb());
    expect(p.committedUnits).toBe(173);
    expect(p.percentOfTarget).toBeCloseTo(86.5, 5);
    expect(p.remainingToTargetUnits).toBe(27);
    expect(p.currentTier?.unitPrice).toBe(25_500);
    expect(p.nextTier?.unitPrice).toBe(24_500);
    expect(p.remainingToNextTierUnits).toBe(27);
    expect(p.payableUnitPrice).toBe(25_500);
    expect(p.targetUnitPrice).toBe(24_500);
    expect(p.nextTierExtraSavingPerUnit).toBe(1_000);
    expect(p.minimumReached).toBe(true);
    expect(p.availableUnits).toBe(427);
  });

  it("n'affiche jamais 0 restant tant que le seuil n'est pas atteint (fractions)", () => {
    const p = computeProgress(gb({ committedBase: 199 * SACK + 45_000 }));
    expect(p.remainingToTargetUnits).toBe(1);
  });

  it("gère le démarrage à zéro", () => {
    const p = computeProgress(gb({ committedBase: 0 }));
    expect(p.percentOfTarget).toBe(0);
    expect(p.minimumReached).toBe(false);
    expect(p.remainingToMinimumUnits).toBe(50);
    expect(p.payableUnitPrice).toBe(26_500);
    expect(p.currentTier).toBeNull();
  });

  it("plafonne le pourcentage à 100 et signale la capacité pleine", () => {
    const p = computeProgress(gb({ committedBase: 590 * SACK, heldBase: 10 * SACK }));
    expect(p.percentOfTarget).toBe(100);
    expect(p.isFull).toBe(true);
    expect(p.nextTier).toBeNull();
    expect(p.remainingToNextTierUnits).toBeNull();
  });

  it("estime le nombre de commandes nécessaires", () => {
    expect(estimateOrdersNeeded(27 * SACK, 12_500)).toBe(108);
    expect(estimateOrdersNeeded(0, 12_500)).toBe(0);
  });
});

describe("participation", () => {
  it("accepte une participation valide", () => {
    expect(() => assertCanJoin(gb(), 5_000, now)).not.toThrow();
  });
  it("refuse si fermé, non ouvert, échu ou capacité dépassée", () => {
    expect(() => assertCanJoin(gb({ status: "CLOSED_SUCCESS" }), 5_000, now)).toThrow(/n'accepte plus/);
    expect(() => assertCanJoin(gb({ opensAt: new Date("2026-11-01") }), 5_000, now)).toThrow(/pas encore ouvert/);
    expect(() => assertCanJoin(gb({ closesAt: new Date("2026-10-01") }), 5_000, now)).toThrow(/date limite/);
    expect(() =>
      assertCanJoin(gb({ committedBase: 599 * SACK, heldBase: 40_000 }), 25_000, now),
    ).toThrow(/capacité/);
    expect(() => assertCanJoin(gb(), 0, now)).toThrow();
  });
});

describe("échéance", () => {
  const after = new Date("2026-10-11T00:00:00Z");
  it("ne fait rien avant la date limite", () => {
    expect(evaluateDeadline(gb(), now)).toEqual({ action: "NONE" });
  });
  it("clôture en succès si le minimum est atteint", () => {
    expect(evaluateDeadline(gb(), after)).toEqual({ action: "CLOSE_SUCCESS" });
  });
  it("prolonge selon la règle EXTEND, puis rembourse", () => {
    const d = evaluateDeadline(gb({ committedBase: 10 * SACK, failurePolicy: "EXTEND" }), after);
    expect(d.action).toBe("EXTEND");
    if (d.action === "EXTEND") expect(d.newClosesAt.toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(
      evaluateDeadline(gb({ committedBase: 10 * SACK, failurePolicy: "EXTEND", extensionsUsed: 1 }), after),
    ).toEqual({ action: "CLOSE_FAILED", policy: "REFUND" });
  });
  it("applique la règle d'échec configurée", () => {
    expect(evaluateDeadline(gb({ committedBase: 0, failurePolicy: "CREDIT_WITH_CONSENT" }), after)).toEqual({
      action: "CLOSE_FAILED",
      policy: "CREDIT_WITH_CONSENT",
    });
  });
});

describe("règlement", () => {
  const participants = [
    { orderItemId: "a", quantity: 1, portionBase: 5_000, paidPortionPrice: 2_650, creditConsent: false },
    { orderItemId: "b", quantity: 2, portionBase: 10_000, paidPortionPrice: 5_100, creditConsent: true },
    { orderItemId: "c", quantity: 1, portionBase: 50_000, paidPortionPrice: 24_500, creditConsent: false },
  ];

  it("rembourse la différence quand un meilleur palier est atteint", () => {
    const s = settleSuccess(TIERS, 210 * SACK, SACK, participants);
    expect(s.finalUnitPrice).toBe(24_500);
    expect(s.lines).toEqual([
      { orderItemId: "a", finalPortionPrice: 2_450, refundAmount: 200 },
      { orderItemId: "b", finalPortionPrice: 4_900, refundAmount: 400 },
      { orderItemId: "c", finalPortionPrice: 24_500, refundAmount: 0 },
    ]);
    expect(s.totalRefund).toBe(600);
  });

  it("ne facture jamais plus que le prix payé, même si le volume a baissé", () => {
    const s = settleSuccess(TIERS, 60 * SACK, SACK, participants);
    expect(s.finalUnitPrice).toBe(26_500);
    const c = s.lines.find((l) => l.orderItemId === "c")!;
    expect(c.finalPortionPrice).toBe(24_500);
    expect(c.refundAmount).toBe(0);
  });

  it("refuse un règlement réussi sous le minimum", () => {
    expect(() => settleSuccess(TIERS, 10 * SACK, SACK, participants)).toThrow(/minimal/);
  });

  it("échec : remboursement intégral, avoir uniquement avec accord", () => {
    const withFees = participants.map((p) => ({ ...p, paidFractionationFee: p.portionBase < SACK ? 150 : 0 }));
    expect(settleFailure("REFUND", withFees).map((l) => l.action)).toEqual(["REFUND", "REFUND", "REFUND"]);
    const credit = settleFailure("CREDIT_WITH_CONSENT", withFees);
    expect(credit.map((l) => l.action)).toEqual(["REFUND", "CREDIT", "REFUND"]);
    expect(credit[1].amount).toBe((5_100 + 150) * 2);
    expect(settleFailure("ALTERNATIVE_PRICE", withFees).every((l) => l.action === "AWAIT_DECISION")).toBe(true);
  });

  it("calcule le supplément pour un prix alternatif", () => {
    expect(alternativePriceSupplement(27_000, 10_000, SACK, 5_300, 2)).toBe(200);
    expect(alternativePriceSupplement(25_000, 10_000, SACK, 5_300, 2)).toBe(0);
  });

  it("décrit les règles d'échec en français", () => {
    expect(describeFailurePolicy("EXTEND", { extensionDays: 3, maxExtensions: 1 })).toMatch(/prolongé de 3 jours/);
    expect(describeFailurePolicy("CREDIT_WITH_CONSENT", { extensionDays: 3, maxExtensions: 1 })).toMatch(/avoir/);
  });
});
