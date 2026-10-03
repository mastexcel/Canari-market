/**
 * Moteur d'agrégation : convertit des commandes ménages (5 kg, 10 kg, 25 kg…)
 * en volume fournisseur (sacs de 50 kg), pertes et emballages compris.
 */
import { BPS } from "./money";
import { invariant } from "./errors";

export interface DemandLine {
  portionBase: number;
  quantity: number; // nombre de portions
}

export interface PortionDemand {
  portionBase: number;
  portions: number;
  totalBase: number;
  isFullUnit: boolean;
}

export interface AggregatedDemand {
  supplierUnitQuantityBase: number;
  totalBase: number;
  byPortion: PortionDemand[];
  /** Volume exact en unités fournisseur (décimal) */
  exactSupplierUnits: number;
  /** Quantité nécessaire pour couvrir les pertes prévues */
  lossAllowanceBase: number;
  /** Unités fournisseur à commander (arrondi supérieur, pertes comprises) */
  supplierUnitsToOrder: number;
  /** Portions plus petites que l'unité fournisseur → à reconditionner */
  portionsToRepack: number;
  totalPortions: number;
}

export function aggregateDemand(
  lines: readonly DemandLine[],
  supplierUnitQuantityBase: number,
  lossRateBps: number,
): AggregatedDemand {
  invariant(supplierUnitQuantityBase > 0, "Unité fournisseur invalide.");
  invariant(lossRateBps >= 0 && lossRateBps < BPS, "Taux de perte invalide.");

  const map = new Map<number, number>();
  for (const l of lines) {
    invariant(Number.isInteger(l.quantity) && l.quantity >= 0, "Quantité de portions invalide.");
    invariant(Number.isInteger(l.portionBase) && l.portionBase > 0, "Taille de portion invalide.");
    map.set(l.portionBase, (map.get(l.portionBase) ?? 0) + l.quantity);
  }

  const byPortion: PortionDemand[] = [...map.entries()]
    .filter(([, portions]) => portions > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([portionBase, portions]) => ({
      portionBase,
      portions,
      totalBase: portionBase * portions,
      isFullUnit: portionBase >= supplierUnitQuantityBase,
    }));

  const totalBase = byPortion.reduce((s, p) => s + p.totalBase, 0);
  // Les pertes ne s'appliquent qu'aux volumes reconditionnés (les unités entières ne sont pas ouvertes).
  const repackBase = byPortion.filter((p) => !p.isFullUnit).reduce((s, p) => s + p.totalBase, 0);
  const lossAllowanceBase = Math.ceil((repackBase * lossRateBps) / BPS);

  return {
    supplierUnitQuantityBase,
    totalBase,
    byPortion,
    exactSupplierUnits: totalBase / supplierUnitQuantityBase,
    lossAllowanceBase,
    supplierUnitsToOrder: Math.ceil((totalBase + lossAllowanceBase) / supplierUnitQuantityBase - 1e-9),
    portionsToRepack: byPortion.filter((p) => !p.isFullUnit).reduce((s, p) => s + p.portions, 0),
    totalPortions: byPortion.reduce((s, p) => s + p.portions, 0),
  };
}
