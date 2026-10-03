import { describe, expect, it } from "vitest";
import { aggregateDemand } from "@/domain/aggregation";
import { assertCanDispatch, assertCanPrepare, computeLotLedger, planFractionation } from "@/domain/fractionation";

const SACK = 50_000;

describe("moteur d'agrégation", () => {
  it("additionne 5 + 10 + 25 + 50 kg et convertit en sacs", () => {
    const d = aggregateDemand(
      [
        { portionBase: 5_000, quantity: 1 },
        { portionBase: 10_000, quantity: 1 },
        { portionBase: 25_000, quantity: 1 },
        { portionBase: 50_000, quantity: 1 },
      ],
      SACK,
      0,
    );
    expect(d.totalBase).toBe(90_000);
    expect(d.exactSupplierUnits).toBeCloseTo(1.8);
    expect(d.supplierUnitsToOrder).toBe(2);
    expect(d.portionsToRepack).toBe(3);
    expect(d.totalPortions).toBe(4);
    expect(d.byPortion[0]).toEqual({ portionBase: 50_000, portions: 1, totalBase: 50_000, isFullUnit: true });
  });

  it("fusionne les lignes de même portion et intègre les pertes sur le reconditionné", () => {
    const d = aggregateDemand(
      [
        { portionBase: 5_000, quantity: 10 },
        { portionBase: 5_000, quantity: 10 },
        { portionBase: 50_000, quantity: 4 },
      ],
      SACK,
      200, // 2 %
    );
    expect(d.byPortion).toHaveLength(2);
    expect(d.totalBase).toBe(300_000);
    expect(d.lossAllowanceBase).toBe(2_000); // 2 % de 100 kg reconditionnés
    expect(d.supplierUnitsToOrder).toBe(7); // 302 kg → 7 sacs
  });

  it("commande exactement quand le volume tombe juste", () => {
    const d = aggregateDemand([{ portionBase: 50_000, quantity: 200 }], SACK, 100);
    expect(d.supplierUnitsToOrder).toBe(200);
    expect(d.lossAllowanceBase).toBe(0);
  });

  it("refuse des entrées invalides", () => {
    expect(() => aggregateDemand([{ portionBase: 5_000, quantity: -1 }], SACK, 0)).toThrow();
    expect(() => aggregateDemand([], SACK, 20_000)).toThrow();
    expect(() => aggregateDemand([], 0, 0)).toThrow();
  });
});

describe("plan de fractionnement", () => {
  it("sépare les sacs remis tels quels des portions à reconditionner", () => {
    const plan = planFractionation(
      [
        { portionBase: 5_000, quantity: 30 },
        { portionBase: 25_000, quantity: 3 },
        { portionBase: 50_000, quantity: 5 },
      ],
      SACK,
      100,
    );
    expect(plan.fullUnitsShippedAsIs).toBe(5);
    expect(plan.repackBase).toBe(225_000);
    expect(plan.expectedLossBase).toBe(2_250);
    expect(plan.unitsToOpen).toBe(5); // 227,25 kg → 5 sacs ouverts
    expect(plan.bagsNeeded).toBe(33);
    expect(plan.expectedLeftoverBase).toBe(250_000 - 225_000 - 2_250);
  });

  it("n'ouvre aucun sac si toute la demande est en sacs entiers", () => {
    const plan = planFractionation([{ portionBase: 50_000, quantity: 3 }], SACK, 100);
    expect(plan.unitsToOpen).toBe(0);
    expect(plan.expectedLeftoverBase).toBe(0);
  });
});

describe("grand livre de lot", () => {
  const movements = [
    { type: "RECEIPT" as const, quantityBase: 1_000_000 }, // 20 sacs reçus
    { type: "FRACTIONATION" as const, quantityBase: 600_000 },
    { type: "LOSS" as const, quantityBase: 4_000 },
    { type: "DISPATCH" as const, quantityBase: 450_000 },
    { type: "RETURN" as const, quantityBase: 10_000 },
    { type: "ADJUSTMENT" as const, quantityBase: -1_000 },
  ];

  it("calcule acheté / préparé / livré / reste / pertes / écarts", () => {
    const l = computeLotLedger(movements, 900_000);
    expect(l.purchasedBase).toBe(1_000_000);
    expect(l.preparedBase).toBe(600_000);
    expect(l.lossBase).toBe(4_000);
    expect(l.dispatchedBase).toBe(450_000);
    expect(l.adjustmentBase).toBe(-1_000);
    expect(l.bulkRemainingBase).toBe(395_000);
    expect(l.preparedInStockBase).toBe(160_000);
    expect(l.toPrepareBase).toBe(300_000);
    expect(l.toDispatchBase).toBe(460_000);
    expect(l.surplusBase).toBe(95_000);
    expect(l.lossRateBps).toBe(40);
    expect(l.shortage).toBe(false);
  });

  it("détecte un manque quand les réservations dépassent la réception", () => {
    expect(computeLotLedger([{ type: "RECEIPT", quantityBase: 100_000 }], 150_000).shortage).toBe(true);
  });

  it("empêche de préparer ou remettre plus que disponible", () => {
    const l = computeLotLedger(movements, 900_000);
    expect(() => assertCanPrepare(l, 5_000, 79)).not.toThrow();
    expect(() => assertCanPrepare(l, 5_000, 80)).toThrow(/insuffisant/);
    expect(() => assertCanPrepare(l, 5_000, 0)).toThrow();
    expect(() => assertCanDispatch(l, 160_000)).not.toThrow();
    expect(() => assertCanDispatch(l, 160_001)).toThrow();
  });
});
