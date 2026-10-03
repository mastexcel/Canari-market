/**
 * Fractionnement : CANARI achète des unités fournisseur (sacs de 50 kg) et
 * prépare des portions (5, 10, 25 kg). Ce module :
 *  1. planifie la préparation à partir de la demande agrégée ;
 *  2. tient le grand livre d'un lot à partir des mouvements de stock immuables
 *     (acheté, préparé, réservé, livré, pertes, écarts, reste).
 */
import { DomainError, invariant } from "./errors";
import { BPS } from "./money";
import type { DemandLine } from "./aggregation";

export interface FractionationPlanLine {
  portionBase: number;
  portions: number;
  /** true si la portion = unité fournisseur : remise telle quelle, sans ouverture */
  shippedAsIs: boolean;
}

export interface FractionationPlan {
  lines: FractionationPlanLine[];
  fullUnitsShippedAsIs: number;
  repackBase: number;
  unitsToOpen: number;
  bagsNeeded: number;
  expectedLossBase: number;
  /** Reste attendu après préparation (unités ouvertes − portions − pertes) */
  expectedLeftoverBase: number;
}

export function planFractionation(
  demand: readonly DemandLine[],
  supplierUnitBase: number,
  lossRateBps: number,
): FractionationPlan {
  const lines: FractionationPlanLine[] = demand
    .filter((d) => d.quantity > 0)
    .map((d) => ({ portionBase: d.portionBase, portions: d.quantity, shippedAsIs: d.portionBase >= supplierUnitBase }))
    .sort((a, b) => b.portionBase - a.portionBase);

  const fullUnitsShippedAsIs = lines.filter((l) => l.shippedAsIs).reduce((s, l) => s + l.portions, 0);
  const repack = lines.filter((l) => !l.shippedAsIs);
  const repackBase = repack.reduce((s, l) => s + l.portionBase * l.portions, 0);
  const expectedLossBase = Math.ceil((repackBase * lossRateBps) / BPS);
  const unitsToOpen = repackBase === 0 ? 0 : Math.ceil((repackBase + expectedLossBase) / supplierUnitBase - 1e-9);

  return {
    lines,
    fullUnitsShippedAsIs,
    repackBase,
    unitsToOpen,
    bagsNeeded: repack.reduce((s, l) => s + l.portions, 0),
    expectedLossBase,
    expectedLeftoverBase: unitsToOpen * supplierUnitBase - repackBase - expectedLossBase,
  };
}

// ─── Grand livre de lot ─────────────────────────────────────

export type MovementType =
  | "RECEIPT"
  | "FRACTIONATION"
  | "LOSS"
  | "DISPATCH"
  | "ADJUSTMENT"
  | "RETURN"
  | "STOCK_SALE_RESERVE"
  | "STOCK_SALE_RELEASE";

export interface LotMovement {
  type: MovementType;
  /** Positif, sauf ADJUSTMENT qui est signé (écart d'inventaire) */
  quantityBase: number;
}

export interface LotLedger {
  purchasedBase: number;
  preparedBase: number;
  lossBase: number;
  dispatchedBase: number;
  returnedBase: number;
  adjustmentBase: number;
  reservedBase: number;
  /** Vrac non encore préparé */
  bulkRemainingBase: number;
  /** Portions préparées encore en stock */
  preparedInStockBase: number;
  /** Reste à préparer pour honorer les réservations */
  toPrepareBase: number;
  /** Reste à livrer aux clients */
  toDispatchBase: number;
  /** Excédent disponible pour la vente en stock (peut être négatif = manque) */
  surplusBase: number;
  /** Taux de perte réel sur le volume reçu */
  lossRateBps: number;
  shortage: boolean;
}

export function computeLotLedger(movements: readonly LotMovement[], reservedBase: number): LotLedger {
  const total = (t: MovementType) =>
    movements.filter((m) => m.type === t).reduce((s, m) => s + m.quantityBase, 0);

  const purchased = total("RECEIPT");
  const prepared = total("FRACTIONATION");
  const loss = total("LOSS");
  const dispatched = total("DISPATCH");
  const returned = total("RETURN");
  const adjustment = total("ADJUSTMENT");

  const bulkRemaining = purchased - prepared - loss + adjustment;
  const surplus = purchased - loss + adjustment - reservedBase;

  return {
    purchasedBase: purchased,
    preparedBase: prepared,
    lossBase: loss,
    dispatchedBase: dispatched,
    returnedBase: returned,
    adjustmentBase: adjustment,
    reservedBase,
    bulkRemainingBase: bulkRemaining,
    preparedInStockBase: prepared - dispatched + returned,
    toPrepareBase: Math.max(0, reservedBase - prepared),
    toDispatchBase: Math.max(0, reservedBase - dispatched + returned),
    surplusBase: surplus,
    lossRateBps: purchased > 0 ? Math.round((loss * BPS) / purchased) : 0,
    shortage: surplus < 0,
  };
}

/** Vérifie qu'une opération de préparation est possible avec le vrac restant. */
export function assertCanPrepare(ledger: LotLedger, portionBase: number, portionCount: number, lossBase = 0): void {
  invariant(Number.isInteger(portionCount) && portionCount > 0, "Nombre de portions invalide.");
  invariant(Number.isInteger(lossBase) && lossBase >= 0, "Perte invalide.");
  const needed = portionBase * portionCount + lossBase;
  if (needed > ledger.bulkRemainingBase) {
    throw new DomainError(
      "INVALID_STATE",
      `Vrac insuffisant : ${needed} demandés, ${ledger.bulkRemainingBase} disponibles dans ce lot.`,
    );
  }
}

/** Vérifie qu'une remise au client est possible avec les portions préparées. */
export function assertCanDispatch(ledger: LotLedger, quantityBase: number): void {
  if (quantityBase > ledger.preparedInStockBase) {
    throw new DomainError("INVALID_STATE", "Portions préparées insuffisantes pour cette remise.");
  }
}
