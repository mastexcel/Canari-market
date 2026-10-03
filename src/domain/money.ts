/**
 * Monnaie : franc CFA (XOF). Pas de sous-unité → tous les montants sont des entiers.
 * Les taux sont exprimés en points de base (bps) : 10 000 bps = 100 %.
 */
import { invariant } from "./errors";

export const BPS = 10_000;

export function assertAmount(amount: number, label = "montant"): void {
  invariant(Number.isInteger(amount), `Le ${label} doit être un entier en FCFA.`);
  invariant(amount >= 0, `Le ${label} ne peut pas être négatif.`);
}

/** Arrondi bancaire au franc le plus proche (demi vers le haut). */
export function roundFcfa(value: number): number {
  return Math.round(value + Number.EPSILON * Math.sign(value));
}

/** Applique un taux en bps à un montant, arrondi au franc. */
export function applyBps(amount: number, bps: number): number {
  return roundFcfa((amount * bps) / BPS);
}

/** Part d'un montant (ex. prix d'un sac 50 kg → prix de 5 kg). */
export function prorate(amount: number, part: number, whole: number): number {
  invariant(whole > 0, "Le dénominateur de prorata doit être positif.");
  return roundFcfa((amount * part) / whole);
}

/** Pourcentage en bps de `part` sur `whole` (0 si whole = 0). */
export function ratioBps(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part * BPS) / whole);
}

const fcfaFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 24 500 FCFA » (espaces insécables fines, conformes au format français). */
export function formatFcfa(amount: number): string {
  return `${fcfaFormatter.format(amount)} FCFA`;
}

/** « 24 500 F » — forme compacte pour les cartes. */
export function formatFcfaShort(amount: number): string {
  return `${fcfaFormatter.format(amount)} F`;
}

/** « 15,3 % » à partir de bps. */
export function formatBps(bps: number, fractionDigits = 1): string {
  const pct = bps / 100;
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(pct)} %`;
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
