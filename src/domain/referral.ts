/**
 * Parrainage — volontairement NON pyramidal :
 *  - un seul niveau (le parrain du parrain ne gagne rien) ;
 *  - récompense déclenchée uniquement par une vraie commande livrée et payée
 *    du filleul (activité commerciale réelle), au-dessus d'un montant minimal ;
 *  - plafond mensuel de récompenses par parrain ;
 *  - pas d'auto-parrainage.
 */
export interface ReferralConfig {
  referrerReward: number;
  refereeReward: number;
  minQualifyingOrderTotal: number;
  maxRewardsPerMonth: number;
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  referrerReward: 500,
  refereeReward: 500,
  minQualifyingOrderTotal: 5_000,
  maxRewardsPerMonth: 10,
};

export type ReferralDecision =
  | { qualifies: true; referrerReward: number; refereeReward: number }
  | { qualifies: false; reason: string };

export function evaluateReferral(input: {
  referrerId: string;
  refereeId: string;
  referralStatus: "PENDING" | "QUALIFIED" | "REWARDED" | "REJECTED";
  order: { status: string; total: number; refundedAmount: number; isFirstDeliveredOrder: boolean };
  referrerRewardsThisMonth: number;
  config?: ReferralConfig;
}): ReferralDecision {
  const c = input.config ?? DEFAULT_REFERRAL_CONFIG;
  if (input.referrerId === input.refereeId) return { qualifies: false, reason: "Auto-parrainage interdit." };
  if (input.referralStatus !== "PENDING") return { qualifies: false, reason: "Parrainage déjà traité." };
  if (input.order.status !== "DELIVERED") return { qualifies: false, reason: "La commande n'est pas encore livrée." };
  if (!input.order.isFirstDeliveredOrder) return { qualifies: false, reason: "Seule la première commande compte." };
  const netTotal = input.order.total - input.order.refundedAmount;
  if (netTotal < c.minQualifyingOrderTotal) {
    return { qualifies: false, reason: `Commande inférieure à ${c.minQualifyingOrderTotal} F.` };
  }
  if (input.referrerRewardsThisMonth >= c.maxRewardsPerMonth) {
    return { qualifies: false, reason: "Plafond mensuel de récompenses atteint." };
  }
  return { qualifies: true, referrerReward: c.referrerReward, refereeReward: c.refereeReward };
}
