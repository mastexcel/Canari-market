/**
 * Communautés : plus une communauté commande ensemble, plus elle obtient
 * d'avantages logistiques (la livraison groupée coûte moins cher à CANARI).
 */
import type { DeliveryBenefits } from "./delivery";

export interface CommunityLevel {
  key: "STARTER" | "BRONZE" | "ARGENT" | "OR";
  label: string;
  minMonthlyOrders: number;
  benefits: DeliveryBenefits;
  description: string;
}

export const COMMUNITY_LEVELS: readonly CommunityLevel[] = [
  {
    key: "STARTER",
    label: "Démarrage",
    minMonthlyOrders: 0,
    benefits: { pickupFeeWaived: false, homeDiscountBps: 0 },
    description: "Commandez ensemble pour débloquer des avantages.",
  },
  {
    key: "BRONZE",
    label: "Bronze",
    minMonthlyOrders: 10,
    benefits: { pickupFeeWaived: true, homeDiscountBps: 0 },
    description: "Retrait gratuit au point relais de la communauté.",
  },
  {
    key: "ARGENT",
    label: "Argent",
    minMonthlyOrders: 30,
    benefits: { pickupFeeWaived: true, homeDiscountBps: 1000 },
    description: "Retrait gratuit et −10 % sur la livraison à domicile.",
  },
  {
    key: "OR",
    label: "Or",
    minMonthlyOrders: 60,
    benefits: { pickupFeeWaived: true, homeDiscountBps: 2500 },
    description: "Retrait gratuit et −25 % sur la livraison à domicile.",
  },
];

export function communityLevel(monthlyOrders: number): CommunityLevel {
  let level = COMMUNITY_LEVELS[0];
  for (const l of COMMUNITY_LEVELS) if (monthlyOrders >= l.minMonthlyOrders) level = l;
  return level;
}

export function nextCommunityLevel(monthlyOrders: number): { level: CommunityLevel; remainingOrders: number } | null {
  const next = COMMUNITY_LEVELS.find((l) => l.minMonthlyOrders > monthlyOrders);
  return next ? { level: next, remainingOrders: next.minMonthlyOrders - monthlyOrders } : null;
}

/** Slug lisible : « CANARI Angré 8e Tranche » → « canari-angre-8e-tranche ». */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
