/**
 * Calcul du récapitulatif de commande (sous-total, économie, fractionnement,
 * livraison, remise, avoir, total). Utilisé à l'identique pour le devis
 * affiché et pour la création de la commande côté serveur.
 */
import { DomainError, invariant } from "./errors";
import { applyBps } from "./money";
import { lineSavings } from "./savings";

export interface CheckoutLine {
  quantity: number;
  unitPrice: number;
  referenceUnitPrice: number;
  fractionationFee: number;
}

export interface PromotionRule {
  type: "PERCENT" | "FIXED" | "FREE_DELIVERY";
  value: number;
  minOrder: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
}

export interface CheckoutTotals {
  subtotal: number;
  referenceTotal: number;
  savings: number;
  savingsBps: number;
  fractionationFees: number;
  deliveryFee: number;
  discount: number;
  creditApplied: number;
  total: number;
}

export function assertPromotionUsable(p: PromotionRule, subtotal: number, now: Date): void {
  if (!p.isActive || now < p.startsAt || now > p.endsAt) {
    throw new DomainError("VALIDATION", "Ce code promo n'est pas valide actuellement.");
  }
  if (p.maxUses !== null && p.usedCount >= p.maxUses) {
    throw new DomainError("VALIDATION", "Ce code promo a atteint son nombre maximal d'utilisations.");
  }
  if (subtotal < p.minOrder) {
    throw new DomainError("VALIDATION", `Ce code promo nécessite un minimum de commande de ${p.minOrder} F.`);
  }
}

export function computeCheckoutTotals(input: {
  lines: readonly CheckoutLine[];
  deliveryFee: number;
  promotion?: PromotionRule | null;
  availableCredit?: number;
  useCredit?: boolean;
  now: Date;
}): CheckoutTotals {
  invariant(input.lines.length > 0, "Votre panier est vide.");
  for (const l of input.lines) {
    invariant(Number.isInteger(l.quantity) && l.quantity > 0, "Quantité invalide.");
  }
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const fractionationFees = input.lines.reduce((s, l) => s + l.fractionationFee * l.quantity, 0);
  const referenceTotal = input.lines.reduce((s, l) => s + l.referenceUnitPrice * l.quantity, 0);
  const savings = input.lines.reduce((s, l) => s + lineSavings(l), 0);

  let deliveryFee = input.deliveryFee;
  let discount = 0;
  if (input.promotion) {
    assertPromotionUsable(input.promotion, subtotal, input.now);
    if (input.promotion.type === "PERCENT") {
      invariant(input.promotion.value > 0 && input.promotion.value <= 50, "Remise en pourcentage invalide.");
      discount = applyBps(subtotal, input.promotion.value * 100);
    } else if (input.promotion.type === "FIXED") {
      discount = Math.min(input.promotion.value, subtotal);
    } else {
      discount = deliveryFee;
    }
  }

  const beforeCredit = subtotal + fractionationFees + deliveryFee - discount;
  const creditApplied = input.useCredit ? Math.min(Math.max(0, input.availableCredit ?? 0), beforeCredit) : 0;
  const total = beforeCredit - creditApplied;

  return {
    subtotal,
    referenceTotal,
    savings,
    savingsBps: referenceTotal > 0 ? Math.round((savings * 10_000) / referenceTotal) : 0,
    fractionationFees,
    deliveryFee,
    discount,
    creditApplied,
    total,
  };
}
