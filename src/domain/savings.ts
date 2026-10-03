/**
 * Économies — KPI principal de CANARI.
 *
 * Économie d'une ligne = (prix de référence − prix effectivement payé, frais de
 * fractionnement inclus) × quantité. Les frais de livraison sont exclus (ils
 * existent aussi pour un achat au détail : trajet, transport) et affichés à part.
 * Une économie n'est jamais négative dans les indicateurs : si CANARI est plus
 * cher, l'économie comptée est 0.
 */
export interface SavingsLine {
  quantity: number;
  referenceUnitPrice: number;
  unitPrice: number;
  finalUnitPrice?: number | null;
  fractionationFee: number;
}

export function lineSavings(l: SavingsLine): number {
  const paid = (l.finalUnitPrice ?? l.unitPrice) + l.fractionationFee;
  return Math.max(0, l.referenceUnitPrice - paid) * l.quantity;
}

export function orderSavings(lines: readonly SavingsLine[]): number {
  return lines.reduce((s, l) => s + lineSavings(l), 0);
}

export function referenceTotal(lines: readonly Pick<SavingsLine, "quantity" | "referenceUnitPrice">[]): number {
  return lines.reduce((s, l) => s + l.referenceUnitPrice * l.quantity, 0);
}

export interface DatedSaving {
  date: Date;
  amount: number;
}

/** Clé de mois « 2026-10 » (UTC = heure d'Abidjan). */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface SavingsSummary {
  total: number;
  thisMonth: number;
  byMonth: Array<{ month: string; amount: number }>;
}

/** Synthèse pour le tableau de bord « Vous avez économisé ». */
export function summarizeSavings(entries: readonly DatedSaving[], now: Date, months = 6): SavingsSummary {
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), 0);
  }
  let total = 0;
  for (const e of entries) {
    total += e.amount;
    const k = monthKey(e.date);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + e.amount);
  }
  return {
    total,
    thisMonth: buckets.get(monthKey(now)) ?? 0,
    byMonth: [...buckets.entries()].map(([month, amount]) => ({ month, amount })),
  };
}
