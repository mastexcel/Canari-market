/**
 * Machine d'états des paiements et règles de remboursement.
 * Les webhooks peuvent arriver en double ou dans le désordre : les
 * transitions sont idempotentes et toute régression est ignorée.
 */
import { DomainError, invariant } from "./errors";

export type PaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: ["AUTHORIZED", "PAID", "FAILED"],
  AUTHORIZED: ["PAID", "FAILED"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type PaymentEventOutcome = "APPLY" | "IGNORE_DUPLICATE" | "IGNORE_STALE";

/**
 * Décide comment traiter un événement prestataire.
 * - même statut → doublon (idempotence) ;
 * - transition valide → appliquer ;
 * - sinon (ex. « failed » reçu après « paid ») → ignorer et journaliser.
 */
export function decidePaymentEvent(current: PaymentStatus, incoming: PaymentStatus): PaymentEventOutcome {
  if (current === incoming && incoming !== "PARTIALLY_REFUNDED") return "IGNORE_DUPLICATE";
  return canTransitionPayment(current, incoming) ? "APPLY" : "IGNORE_STALE";
}

export function refundableAmount(p: { amount: number; refundedAmount: number; status: PaymentStatus }): number {
  if (p.status !== "PAID" && p.status !== "PARTIALLY_REFUNDED") return 0;
  return p.amount - p.refundedAmount;
}

/** Statut après un remboursement de `refund` FCFA. */
export function statusAfterRefund(
  p: { amount: number; refundedAmount: number; status: PaymentStatus },
  refund: number,
): { status: PaymentStatus; refundedAmount: number } {
  invariant(Number.isInteger(refund) && refund > 0, "Montant de remboursement invalide.");
  const available = refundableAmount(p);
  if (refund > available) {
    throw new DomainError("INVALID_STATE", `Remboursement de ${refund} F supérieur au montant remboursable (${available} F).`);
  }
  const refundedAmount = p.refundedAmount + refund;
  return { refundedAmount, status: refundedAmount === p.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" };
}

/** Masque un numéro : +225 07 •• •• 56 78. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.slice(-10);
  if (local.length < 10) return "•••";
  return `+225 ${local.slice(0, 2)} •• •• ${local.slice(6, 8)} ${local.slice(8, 10)}`;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  AUTHORIZED: "Autorisé",
  PAID: "Payé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
  PARTIALLY_REFUNDED: "Partiellement remboursé",
};
