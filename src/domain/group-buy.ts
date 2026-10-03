/**
 * Achats groupés : progression, éligibilité, échéance et règlement final.
 * Logique pure — l'orchestration (transactions, paiements) vit dans GroupBuyService.
 */
import { DomainError, invariant } from "./errors";
import {
  normalizeTiers,
  minimumUnits,
  nextTier,
  payableUnitPrice,
  portionPrice,
  reachedTier,
  settledPortionPrice,
  targetUnitPrice,
  type Tier,
} from "./pricing";
import { toSupplierUnits } from "./units";

export type GroupBuyStatus = "DRAFT" | "OPEN" | "CLOSED_SUCCESS" | "CLOSED_FAILED" | "CANCELLED" | "COMPLETED";
export type FailurePolicy = "EXTEND" | "REFUND" | "ALTERNATIVE_PRICE" | "CREDIT_WITH_CONSENT";

export interface GroupBuyState {
  status: GroupBuyStatus;
  supplierUnitQuantityBase: number;
  targetUnits: number;
  maxUnits: number;
  committedBase: number;
  heldBase: number;
  participantCount: number;
  tiers: readonly Tier[];
  opensAt: Date;
  closesAt: Date;
  failurePolicy: FailurePolicy;
  extensionsUsed: number;
  maxExtensions: number;
  extensionDays: number;
}

export interface GroupBuyProgress {
  committedUnits: number;
  targetUnits: number;
  /** 0–100, plafonné à 100 pour l'affichage */
  percentOfTarget: number;
  remainingToTargetUnits: number;
  minimumUnits: number;
  minimumReached: boolean;
  remainingToMinimumUnits: number;
  currentTier: Tier | null;
  nextTier: Tier | null;
  remainingToNextTierUnits: number | null;
  /** Prix unitaire à payer maintenant (plafond garanti) */
  payableUnitPrice: number;
  /** Prix unitaire au volume objectif */
  targetUnitPrice: number;
  /** Économie supplémentaire par unité fournisseur si le prochain palier est atteint */
  nextTierExtraSavingPerUnit: number | null;
  availableUnits: number;
  isFull: boolean;
}

/** Arrondi « honnête » d'un reste : on n'affiche jamais 0 tant que le seuil n'est pas atteint. */
function ceilRemaining(units: number): number {
  return units <= 0 ? 0 : Math.ceil(units - 1e-9);
}

export function computeProgress(gb: Pick<GroupBuyState,
  "supplierUnitQuantityBase" | "targetUnits" | "maxUnits" | "committedBase" | "heldBase" | "tiers">): GroupBuyProgress {
  const tiers = normalizeTiers(gb.tiers);
  const committedUnits = toSupplierUnits(gb.committedBase, gb.supplierUnitQuantityBase);
  const minUnits = minimumUnits(tiers);
  const current = reachedTier(tiers, committedUnits);
  const next = nextTier(tiers, committedUnits);
  const payable = payableUnitPrice(tiers, committedUnits);
  const usedUnits = toSupplierUnits(gb.committedBase + gb.heldBase, gb.supplierUnitQuantityBase);
  const available = Math.max(0, gb.maxUnits - usedUnits);

  return {
    committedUnits,
    targetUnits: gb.targetUnits,
    percentOfTarget: Math.min(100, gb.targetUnits > 0 ? (committedUnits / gb.targetUnits) * 100 : 0),
    remainingToTargetUnits: ceilRemaining(gb.targetUnits - committedUnits),
    minimumUnits: minUnits,
    minimumReached: committedUnits >= minUnits,
    remainingToMinimumUnits: ceilRemaining(minUnits - committedUnits),
    currentTier: current,
    nextTier: next,
    remainingToNextTierUnits: next ? ceilRemaining(next.minUnits - committedUnits) : null,
    payableUnitPrice: payable,
    targetUnitPrice: targetUnitPrice(tiers, gb.targetUnits),
    nextTierExtraSavingPerUnit: next ? payable - next.unitPrice : null,
    availableUnits: available,
    isFull: available <= 1e-9,
  };
}

/**
 * Estimation du nombre de commandes nécessaires pour combler un reste, à partir
 * de la quantité moyenne par participant (repli : portion médiane proposée).
 */
export function estimateOrdersNeeded(remainingBase: number, avgParticipantBase: number): number {
  if (remainingBase <= 0) return 0;
  invariant(avgParticipantBase > 0, "La quantité moyenne doit être positive.");
  return Math.ceil(remainingBase / avgParticipantBase);
}

/** Vérifie qu'un ménage peut réserver `quantityBase` maintenant. */
export function assertCanJoin(gb: GroupBuyState, quantityBase: number, now: Date): void {
  if (gb.status !== "OPEN") {
    throw new DomainError("INVALID_STATE", "Cet achat groupé n'accepte plus de participations.");
  }
  if (now < gb.opensAt) throw new DomainError("INVALID_STATE", "Cet achat groupé n'est pas encore ouvert.");
  if (now >= gb.closesAt) throw new DomainError("INVALID_STATE", "La date limite de cet achat groupé est passée.");
  invariant(Number.isInteger(quantityBase) && quantityBase > 0, "Quantité invalide.");
  const capacityBase = gb.maxUnits * gb.supplierUnitQuantityBase;
  if (gb.committedBase + gb.heldBase + quantityBase > capacityBase) {
    throw new DomainError(
      "CAPACITY_EXCEEDED",
      "La capacité du fournisseur est atteinte pour cet achat groupé. Réduisez la quantité ou rejoignez le prochain.",
    );
  }
}

// ─── Échéance ──────────────────────────────────────────────

export type DeadlineDecision =
  | { action: "NONE" }
  | { action: "CLOSE_SUCCESS" }
  | { action: "EXTEND"; newClosesAt: Date }
  | { action: "CLOSE_FAILED"; policy: Exclude<FailurePolicy, "EXTEND"> };

const DAY_MS = 86_400_000;

/**
 * Décision à l'échéance. Une prolongation n'est possible que dans la limite
 * de maxExtensions ; au-delà, la règle de repli est le remboursement.
 */
export function evaluateDeadline(gb: GroupBuyState, now: Date): DeadlineDecision {
  if (gb.status !== "OPEN" || now < gb.closesAt) return { action: "NONE" };
  const committedUnits = toSupplierUnits(gb.committedBase, gb.supplierUnitQuantityBase);
  if (committedUnits >= minimumUnits(gb.tiers)) return { action: "CLOSE_SUCCESS" };
  if (gb.failurePolicy === "EXTEND") {
    if (gb.extensionsUsed < gb.maxExtensions) {
      return { action: "EXTEND", newClosesAt: new Date(gb.closesAt.getTime() + gb.extensionDays * DAY_MS) };
    }
    return { action: "CLOSE_FAILED", policy: "REFUND" };
  }
  return { action: "CLOSE_FAILED", policy: gb.failurePolicy };
}

// ─── Règlement à la clôture ────────────────────────────────

export interface SettlementParticipant {
  orderItemId: string;
  quantity: number; // nombre de portions
  portionBase: number;
  paidPortionPrice: number; // hors frais de fractionnement
  creditConsent: boolean;
}

export interface SuccessLine {
  orderItemId: string;
  finalPortionPrice: number;
  refundAmount: number;
}

export interface SuccessSettlement {
  outcome: "SUCCESS";
  finalUnitPrice: number;
  lines: SuccessLine[];
  totalRefund: number;
}

/**
 * Clôture réussie : chaque participant paie le prix du palier final, plafonné
 * au prix qu'il a déjà payé. La différence lui est remboursée.
 */
export function settleSuccess(
  tiers: readonly Tier[],
  committedBase: number,
  supplierUnitBase: number,
  participants: readonly SettlementParticipant[],
): SuccessSettlement {
  const units = toSupplierUnits(committedBase, supplierUnitBase);
  const tier = reachedTier(tiers, units);
  if (!tier) throw new DomainError("INVALID_STATE", "Le seuil minimal n'est pas atteint.");
  const lines = participants.map((p) => {
    const finalPrice = settledPortionPrice(p.paidPortionPrice, portionPrice(tier.unitPrice, p.portionBase, supplierUnitBase));
    return {
      orderItemId: p.orderItemId,
      finalPortionPrice: finalPrice,
      refundAmount: (p.paidPortionPrice - finalPrice) * p.quantity,
    };
  });
  return {
    outcome: "SUCCESS",
    finalUnitPrice: tier.unitPrice,
    lines,
    totalRefund: lines.reduce((s, l) => s + l.refundAmount, 0),
  };
}

export type FailureAction = "REFUND" | "CREDIT" | "AWAIT_DECISION";

export interface FailureLine {
  orderItemId: string;
  action: FailureAction;
  /** Montant concerné (produit + frais de fractionnement payés) */
  amount: number;
}

/**
 * Clôture en échec : remboursement intégral par défaut. L'avoir n'est utilisé
 * QUE si le participant l'a explicitement accepté avant de payer. Le prix
 * alternatif exige une décision explicite du participant.
 */
export function settleFailure(
  policy: Exclude<FailurePolicy, "EXTEND">,
  participants: ReadonlyArray<SettlementParticipant & { paidFractionationFee: number }>,
): FailureLine[] {
  return participants.map((p) => {
    const amount = (p.paidPortionPrice + p.paidFractionationFee) * p.quantity;
    let action: FailureAction = "REFUND";
    if (policy === "CREDIT_WITH_CONSENT" && p.creditConsent) action = "CREDIT";
    if (policy === "ALTERNATIVE_PRICE") action = "AWAIT_DECISION";
    return { orderItemId: p.orderItemId, action, amount };
  });
}

/** Supplément à payer si un participant accepte le prix alternatif (jamais négatif). */
export function alternativePriceSupplement(
  alternativeUnitPrice: number,
  portionBase: number,
  supplierUnitBase: number,
  paidPortionPrice: number,
  quantity: number,
): number {
  const alt = portionPrice(alternativeUnitPrice, portionBase, supplierUnitBase);
  return Math.max(0, alt - paidPortionPrice) * quantity;
}

/** Texte explicatif des règles d'échec, affiché AVANT paiement. */
export function describeFailurePolicy(
  policy: FailurePolicy,
  opts: { extensionDays: number; maxExtensions: number },
): string {
  switch (policy) {
    case "EXTEND":
      return `Si le seuil n'est pas atteint à la date limite, l'achat est prolongé de ${opts.extensionDays} jours (${opts.maxExtensions} fois au maximum). Ensuite, vous êtes remboursé intégralement.`;
    case "REFUND":
      return "Si le seuil n'est pas atteint à la date limite, vous êtes remboursé intégralement sur votre moyen de paiement.";
    case "ALTERNATIVE_PRICE":
      return "Si le seuil n'est pas atteint, Sesam-Market vous propose un prix alternatif. Vous choisissez : accepter, ou être remboursé intégralement. Sans réponse de votre part, vous êtes remboursé.";
    case "CREDIT_WITH_CONSENT":
      return "Si le seuil n'est pas atteint, vous êtes remboursé intégralement, sauf si vous avez choisi ci-dessous de recevoir un avoir Sesam-Market à la place.";
  }
}
