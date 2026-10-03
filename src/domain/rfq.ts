/**
 * Comparaison multicritère des offres fournisseurs (RFQ).
 * Le système CLASSE et EXPLIQUE ; il ne sélectionne jamais automatiquement.
 * Le choix revient à l'administrateur, avec justification obligatoire s'il
 * ne retient pas l'offre la mieux classée.
 */
import { DomainError } from "./errors";

export interface RfqOfferInput {
  responseId: string;
  supplierName: string;
  unitPrice: number;
  unitsOffered: number;
  leadTimeDays: number;
  qualityScore: number; // 0–100
  reliabilityScore: number; // 0–100
  onTimeRateBps: number; // 0–10 000
  supplierVerified: boolean;
}

export const RFQ_WEIGHTS = {
  price: 0.4,
  quality: 0.2,
  reliability: 0.15,
  leadTime: 0.15,
  capacity: 0.1,
} as const;

export interface RankedOffer extends RfqOfferInput {
  scores: { price: number; quality: number; reliability: number; leadTime: number; capacity: number };
  total: number; // 0–100
  eligible: boolean;
  flags: string[];
  rank: number;
}

export function rankOffers(offers: readonly RfqOfferInput[], requiredUnits: number, neededInDays: number): RankedOffer[] {
  if (offers.length === 0) return [];
  // Les références (meilleur prix, meilleur délai) sont prises parmi les offres éligibles.
  const pool = offers.some((o) => o.supplierVerified) ? offers.filter((o) => o.supplierVerified) : offers;
  const minPrice = Math.min(...pool.map((o) => o.unitPrice));
  const minLead = Math.max(1, Math.min(...pool.map((o) => o.leadTimeDays)));

  const scored = offers.map((o) => {
    const reliability = (o.reliabilityScore / 100) * 0.6 + (o.onTimeRateBps / 10_000) * 0.4;
    const scores = {
      price: Math.min(1, minPrice / o.unitPrice),
      quality: o.qualityScore / 100,
      reliability,
      leadTime: Math.min(1, minLead / Math.max(1, o.leadTimeDays)),
      capacity: Math.min(1, o.unitsOffered / requiredUnits),
    };
    const total =
      100 *
      (scores.price * RFQ_WEIGHTS.price +
        scores.quality * RFQ_WEIGHTS.quality +
        scores.reliability * RFQ_WEIGHTS.reliability +
        scores.leadTime * RFQ_WEIGHTS.leadTime +
        scores.capacity * RFQ_WEIGHTS.capacity);

    const flags: string[] = [];
    if (!o.supplierVerified) flags.push("Fournisseur non vérifié (KYB incomplet)");
    if (o.unitsOffered < requiredUnits) flags.push(`Capacité partielle : ${o.unitsOffered}/${requiredUnits} unités`);
    if (o.leadTimeDays > neededInDays) flags.push(`Délai (${o.leadTimeDays} j) au-delà de la date souhaitée`);
    if (o.unitPrice === minPrice && reliability < 0.6) flags.push("Moins cher mais fiabilité faible");
    if (o.qualityScore < 60) flags.push("Qualité historique insuffisante");

    return { ...o, scores, total: Math.round(total * 10) / 10, eligible: o.supplierVerified, flags, rank: 0 };
  });

  scored.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.total - a.total || a.unitPrice - b.unitPrice);
  return scored.map((s, i) => ({ ...s, rank: i + 1 }));
}

/** Contrôle une décision d'attribution. */
export function assertAwardDecision(ranked: readonly RankedOffer[], chosenId: string, justification?: string | null): void {
  const chosen = ranked.find((r) => r.responseId === chosenId);
  if (!chosen) throw new DomainError("NOT_FOUND", "Offre introuvable.");
  if (!chosen.eligible) throw new DomainError("FORBIDDEN", "Impossible d'attribuer à un fournisseur non vérifié.");
  const best = ranked[0];
  if (best.responseId !== chosenId && (!justification || justification.trim().length < 15)) {
    throw new DomainError(
      "VALIDATION",
      "Vous ne retenez pas l'offre la mieux classée : une justification (15 caractères minimum) est obligatoire.",
    );
  }
}
