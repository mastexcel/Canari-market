/**
 * Moteur de prix par paliers.
 *
 * Un achat groupé définit des paliers clients exprimés PAR UNITÉ FOURNISSEUR
 * (ex. 24 500 F le sac de 50 kg à partir de 200 sacs engagés).
 * Le prix d'une portion (5 kg, 10 kg…) est le prorata du prix unitaire,
 * plus des frais de fractionnement explicites lorsqu'elle est plus petite
 * que l'unité fournisseur.
 *
 * Garantie CANARI : le prix payé est un PLAFOND. À la clôture, si un palier
 * plus avantageux est atteint, la différence est remboursée ; le prix ne peut
 * jamais augmenter après paiement.
 */
import { DomainError, invariant } from "./errors";
import { prorate } from "./money";

export interface Tier {
  minUnits: number;
  unitPrice: number;
}

/** Trie et valide les paliers : seuils strictement croissants, prix strictement décroissants. */
export function normalizeTiers(tiers: readonly Tier[]): Tier[] {
  invariant(tiers.length > 0, "Un achat groupé doit comporter au moins un palier de prix.");
  const sorted = [...tiers].sort((a, b) => a.minUnits - b.minUnits);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    invariant(Number.isInteger(t.minUnits) && t.minUnits > 0, "Chaque seuil de palier doit être un entier positif.");
    invariant(Number.isInteger(t.unitPrice) && t.unitPrice > 0, "Chaque prix de palier doit être un entier positif.");
    if (i > 0) {
      const prev = sorted[i - 1];
      if (t.minUnits === prev.minUnits) {
        throw new DomainError("VALIDATION", `Deux paliers ont le même seuil (${t.minUnits}).`);
      }
      invariant(
        t.unitPrice < prev.unitPrice,
        `Le prix du palier ${t.minUnits} doit être inférieur à celui du palier ${prev.minUnits}.`,
      );
    }
  }
  return sorted;
}

/** Palier atteint pour un volume engagé (null si le premier seuil n'est pas atteint). */
export function reachedTier(tiers: readonly Tier[], committedUnits: number): Tier | null {
  const sorted = normalizeTiers(tiers);
  let reached: Tier | null = null;
  for (const t of sorted) {
    if (committedUnits >= t.minUnits) reached = t;
  }
  return reached;
}

export function nextTier(tiers: readonly Tier[], committedUnits: number): Tier | null {
  return normalizeTiers(tiers).find((t) => t.minUnits > committedUnits) ?? null;
}

/** Seuil minimal pour que l'achat groupé ait lieu (= premier palier). */
export function minimumUnits(tiers: readonly Tier[]): number {
  return normalizeTiers(tiers)[0].minUnits;
}

/**
 * Prix unitaire à payer maintenant : prix du palier atteint, ou à défaut du
 * premier palier (prix applicable si l'achat aboutit).
 */
export function payableUnitPrice(tiers: readonly Tier[], committedUnits: number): number {
  const sorted = normalizeTiers(tiers);
  return (reachedTier(sorted, committedUnits) ?? sorted[0]).unitPrice;
}

/** Prix unitaire au volume objectif (le « prix CANARI » mis en avant). */
export function targetUnitPrice(tiers: readonly Tier[], targetUnits: number): number {
  const sorted = normalizeTiers(tiers);
  return (reachedTier(sorted, targetUnits) ?? sorted[0]).unitPrice;
}

/** Prix d'une portion (hors frais de fractionnement). */
export function portionPrice(unitPrice: number, portionBase: number, supplierUnitBase: number): number {
  invariant(portionBase > 0, "La portion doit être positive.");
  return prorate(unitPrice, portionBase, supplierUnitBase);
}

/** Frais de fractionnement appliqués à une portion plus petite que l'unité fournisseur. */
export function portionFractionationFee(
  portionBase: number,
  supplierUnitBase: number,
  feePerPortion: number,
): number {
  return portionBase < supplierUnitBase ? feePerPortion : 0;
}

/**
 * Prix final d'une portion pour un participant : jamais supérieur à ce qu'il a payé.
 */
export function settledPortionPrice(paidPortionPrice: number, finalPortionPrice: number): number {
  return Math.min(paidPortionPrice, finalPortionPrice);
}

/** Valide qu'une liste de portions est cohérente avec l'unité fournisseur. */
export function validatePortions(portionsBase: readonly number[], supplierUnitBase: number): void {
  invariant(portionsBase.length > 0, "Proposez au moins une portion.");
  const seen = new Set<number>();
  for (const p of portionsBase) {
    invariant(Number.isInteger(p) && p > 0, "Chaque portion doit être une quantité entière positive.");
    invariant(p <= supplierUnitBase, "Une portion ne peut pas dépasser l'unité fournisseur.");
    invariant(!seen.has(p), "Portions en double.");
    seen.add(p);
  }
}
