import { describe, expect, it } from "vitest";
import {
  minimumUnits,
  nextTier,
  normalizeTiers,
  payableUnitPrice,
  portionFractionationFee,
  portionPrice,
  reachedTier,
  settledPortionPrice,
  targetUnitPrice,
  validatePortions,
} from "@/domain/pricing";
import { applyBps, formatBps, formatFcfa, prorate, ratioBps } from "@/domain/money";
import { formatQuantity } from "@/domain/units";

const RICE_TIERS = [
  { minUnits: 100, unitPrice: 25_500 },
  { minUnits: 50, unitPrice: 26_500 },
  { minUnits: 500, unitPrice: 23_800 },
  { minUnits: 200, unitPrice: 24_500 },
];
const SACK = 50_000; // 50 kg en grammes

describe("money", () => {
  it("formate en FCFA au format français", () => {
    expect(formatFcfa(24_500)).toBe("24 500 FCFA");
    expect(formatBps(1530)).toBe("15,3 %");
  });
  it("calcule prorata, bps et ratios en entiers", () => {
    expect(prorate(24_500, 5_000, SACK)).toBe(2_450);
    expect(prorate(26_500, 25_000, SACK)).toBe(13_250);
    expect(prorate(1000, 1, 3)).toBe(333);
    expect(applyBps(25_000, 150)).toBe(375);
    expect(ratioBps(4_500, 29_500)).toBe(1525);
    expect(ratioBps(1, 0)).toBe(0);
  });
  it("refuse un dénominateur nul", () => {
    expect(() => prorate(10, 1, 0)).toThrow();
  });
});

describe("units", () => {
  it("formate les quantités", () => {
    expect(formatQuantity(5_000, "GRAM")).toBe("5 kg");
    expect(formatQuantity(500, "GRAM")).toBe("500 g");
    expect(formatQuantity(10_000_000, "GRAM")).toBe("10 t");
    expect(formatQuantity(1_500, "MILLILITER")).toBe("1,5 L");
    expect(formatQuantity(30, "PIECE")).toBe("30 pièces");
    expect(formatQuantity(1, "PIECE")).toBe("1 pièce");
  });
});

describe("paliers de prix", () => {
  it("trie les paliers et valide la dégressivité", () => {
    expect(normalizeTiers(RICE_TIERS).map((t) => t.minUnits)).toEqual([50, 100, 200, 500]);
    expect(() => normalizeTiers([])).toThrow(/au moins un palier/);
    expect(() =>
      normalizeTiers([
        { minUnits: 10, unitPrice: 100 },
        { minUnits: 20, unitPrice: 120 },
      ]),
    ).toThrow(/inférieur/);
    expect(() =>
      normalizeTiers([
        { minUnits: 10, unitPrice: 100 },
        { minUnits: 10, unitPrice: 90 },
      ]),
    ).toThrow(/même seuil/);
    expect(() => normalizeTiers([{ minUnits: 0, unitPrice: 100 }])).toThrow();
    expect(() => normalizeTiers([{ minUnits: 5, unitPrice: 10.5 }])).toThrow();
  });

  it("détermine le palier atteint et le suivant", () => {
    expect(reachedTier(RICE_TIERS, 49.9)).toBeNull();
    expect(reachedTier(RICE_TIERS, 50)?.unitPrice).toBe(26_500);
    expect(reachedTier(RICE_TIERS, 173)?.unitPrice).toBe(25_500);
    expect(reachedTier(RICE_TIERS, 600)?.unitPrice).toBe(23_800);
    expect(nextTier(RICE_TIERS, 173)?.minUnits).toBe(200);
    expect(nextTier(RICE_TIERS, 500)).toBeNull();
    expect(minimumUnits(RICE_TIERS)).toBe(50);
  });

  it("prix payable = palier atteint, sinon premier palier", () => {
    expect(payableUnitPrice(RICE_TIERS, 10)).toBe(26_500);
    expect(payableUnitPrice(RICE_TIERS, 173)).toBe(25_500);
    expect(targetUnitPrice(RICE_TIERS, 200)).toBe(24_500);
    expect(targetUnitPrice(RICE_TIERS, 20)).toBe(26_500);
  });

  it("calcule le prix des portions et les frais de fractionnement", () => {
    expect(portionPrice(24_500, 5_000, SACK)).toBe(2_450);
    expect(portionPrice(24_500, 10_000, SACK)).toBe(4_900);
    expect(portionPrice(24_500, 25_000, SACK)).toBe(12_250);
    expect(portionPrice(24_500, 50_000, SACK)).toBe(24_500);
    expect(portionFractionationFee(5_000, SACK, 150)).toBe(150);
    expect(portionFractionationFee(50_000, SACK, 150)).toBe(0);
    expect(() => portionPrice(24_500, 0, SACK)).toThrow();
  });

  it("le prix réglé ne dépasse jamais le prix payé", () => {
    expect(settledPortionPrice(2_650, 2_450)).toBe(2_450);
    expect(settledPortionPrice(2_450, 2_650)).toBe(2_450);
  });

  it("valide les portions proposées", () => {
    expect(() => validatePortions([5_000, 10_000, 50_000], SACK)).not.toThrow();
    expect(() => validatePortions([60_000], SACK)).toThrow(/dépasser/);
    expect(() => validatePortions([5_000, 5_000], SACK)).toThrow(/double/);
    expect(() => validatePortions([], SACK)).toThrow();
  });
});

describe("unitNoun", () => {
  it("accorde le nom d'unité fournisseur", async () => {
    const { unitNoun } = await import("@/domain/units");
    expect(unitNoun("Sac 50 kg", 2)).toBe("sacs de 50 kg");
    expect(unitNoun("Sac 50 kg", 1)).toBe("sac de 50 kg");
    expect(unitNoun("Bidon 20 L", 27)).toBe("bidons de 20 L");
    expect(unitNoun("Carton de 10 kits", 3)).toBe("cartons de 10 kits");
  });
});
