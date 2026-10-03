/**
 * Prix de référence « marché ». Règle : un prix de référence périmé n'est
 * JAMAIS présenté comme actuel et ne sert pas à revendiquer une économie.
 */
export const REFERENCE_PRICE_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReferenceFreshness = "fresh" | "stale";

export interface ReferenceSnapshot {
  price: number;
  observedAt: Date;
  source: string;
  method: string;
}

export function referenceAgeDays(observedAt: Date, now: Date): number {
  return Math.floor((now.getTime() - observedAt.getTime()) / DAY_MS);
}

export function referenceFreshness(
  observedAt: Date,
  now: Date,
  maxAgeDays = REFERENCE_PRICE_MAX_AGE_DAYS,
): ReferenceFreshness {
  return referenceAgeDays(observedAt, now) <= maxAgeDays ? "fresh" : "stale";
}

/**
 * Prix de référence exploitable pour calculer une économie : null s'il est périmé
 * ou dans le futur (donnée incohérente).
 */
export function usableReferencePrice(ref: ReferenceSnapshot, now: Date): number | null {
  if (ref.observedAt.getTime() > now.getTime() + DAY_MS) return null;
  return referenceFreshness(ref.observedAt, now) === "fresh" ? ref.price : null;
}

/** Choisit le relevé le plus récent parmi une liste (ou null). */
export function latestReference<T extends { observedAt: Date }>(refs: readonly T[]): T | null {
  if (refs.length === 0) return null;
  return refs.reduce((best, r) => (r.observedAt > best.observedAt ? r : best));
}
