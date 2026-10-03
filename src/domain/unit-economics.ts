/**
 * Économie unitaire d'un achat groupé.
 * Un administrateur ne peut pas publier une campagne structurellement
 * déficitaire sans avertissement explicite (voir assessCampaign).
 */
import { BPS, applyBps, ratioBps, roundFcfa } from "./money";
import { normalizeTiers, type Tier } from "./pricing";

export interface CampaignCosts {
  supplierUnitQuantityBase: number;
  supplierUnitCost: number;
  inboundTransportPerUnit: number;
  storagePerUnit: number;
  fractionationFeePerPortion: number;
  fractionationCostPerPortion: number;
  packagingCostPerPortion: number;
  lossRateBps: number;
  paymentFeeBps: number;
  deliveryCostPerOrder: number;
  promotionCostPerUnit: number;
  expectedAvgPortionBase: number;
}

export interface UnitEconomicsInput extends CampaignCosts {
  units: number; // unités fournisseur vendues
  customerUnitPrice: number;
  /** Nombre de commandes ; par défaut une commande par portion (hypothèse prudente) */
  orders?: number;
  /** Portions effectives (si connues), sinon estimées depuis expectedAvgPortionBase */
  portions?: number;
  repackedPortions?: number;
}

export interface UnitEconomics {
  units: number;
  portions: number;
  revenueProducts: number;
  revenueFractionation: number;
  revenue: number;
  supplierCost: number;
  inboundTransport: number;
  lossCost: number;
  grossMargin: number;
  grossMarginBps: number;
  storage: number;
  fractionation: number;
  packaging: number;
  paymentFees: number;
  delivery: number;
  promotions: number;
  netMargin: number;
  netMarginBps: number;
  netMarginPerUnit: number;
}

export function computeUnitEconomics(i: UnitEconomicsInput): UnitEconomics {
  const totalBase = i.units * i.supplierUnitQuantityBase;
  const portions = i.portions ?? Math.ceil(totalBase / i.expectedAvgPortionBase);
  const repacked =
    i.repackedPortions ?? (i.expectedAvgPortionBase < i.supplierUnitQuantityBase ? portions : 0);
  const orders = i.orders ?? portions;

  const revenueProducts = roundFcfa(i.units * i.customerUnitPrice);
  const revenueFractionation = repacked * i.fractionationFeePerPortion;
  const revenue = revenueProducts + revenueFractionation;

  // Les pertes obligent à acheter plus que ce qui est vendu (uniquement sur le volume reconditionné).
  const repackShare = portions > 0 ? repacked / portions : 0;
  const lossUnits = (i.units * repackShare * i.lossRateBps) / BPS;
  const supplierCost = roundFcfa(i.units * i.supplierUnitCost);
  const lossCost = roundFcfa(lossUnits * (i.supplierUnitCost + i.inboundTransportPerUnit));
  const inboundTransport = roundFcfa(i.units * i.inboundTransportPerUnit);
  const grossMargin = revenue - supplierCost - inboundTransport - lossCost;

  const storage = roundFcfa((i.units + lossUnits) * i.storagePerUnit);
  const fractionation = repacked * i.fractionationCostPerPortion;
  const packaging = repacked * i.packagingCostPerPortion;
  const paymentFees = applyBps(revenue, i.paymentFeeBps);
  const delivery = orders * i.deliveryCostPerOrder;
  const promotions = roundFcfa(i.units * i.promotionCostPerUnit);
  const netMargin = grossMargin - storage - fractionation - packaging - paymentFees - delivery - promotions;

  return {
    units: i.units,
    portions,
    revenueProducts,
    revenueFractionation,
    revenue,
    supplierCost,
    inboundTransport,
    lossCost,
    grossMargin,
    grossMarginBps: ratioBps(grossMargin, revenue),
    storage,
    fractionation,
    packaging,
    paymentFees,
    delivery,
    promotions,
    netMargin,
    netMarginBps: ratioBps(netMargin, revenue),
    netMarginPerUnit: i.units > 0 ? roundFcfa(netMargin / i.units) : 0,
  };
}

export type CampaignWarningCode =
  | "NET_DEFICIT"
  | "GROSS_DEFICIT"
  | "THIN_MARGIN"
  | "NO_CUSTOMER_SAVING"
  | "STALE_REFERENCE";

export interface CampaignWarning {
  code: CampaignWarningCode;
  severity: "blocking" | "warning";
  message: string;
  tierMinUnits?: number;
}

export interface CampaignAssessment {
  scenarios: Array<{ tier: Tier; economics: UnitEconomics }>;
  warnings: CampaignWarning[];
  /** true = publication impossible sans acquittement explicite et motivé */
  requiresAcknowledgement: boolean;
}

export const THIN_MARGIN_BPS = 300; // 3 % de marge nette

/**
 * Évalue la campagne à chaque palier (au seuil du palier = pire cas de volume
 * pour ce prix) et produit des avertissements.
 */
export function assessCampaign(
  costs: CampaignCosts,
  tiers: readonly Tier[],
  referenceUnitPrice: number,
  referenceIsFresh: boolean,
): CampaignAssessment {
  const sorted = normalizeTiers(tiers);
  const warnings: CampaignWarning[] = [];
  const scenarios = sorted.map((tier) => ({
    tier,
    economics: computeUnitEconomics({ ...costs, units: tier.minUnits, customerUnitPrice: tier.unitPrice }),
  }));

  for (const { tier, economics } of scenarios) {
    if (economics.grossMargin < 0) {
      warnings.push({
        code: "GROSS_DEFICIT",
        severity: "blocking",
        tierMinUnits: tier.minUnits,
        message: `Marge brute négative au palier ${tier.minUnits} (${economics.grossMargin} F).`,
      });
    } else if (economics.netMargin < 0) {
      warnings.push({
        code: "NET_DEFICIT",
        severity: "blocking",
        tierMinUnits: tier.minUnits,
        message: `Marge nette estimée négative au palier ${tier.minUnits} (${economics.netMargin} F).`,
      });
    } else if (economics.netMarginBps < THIN_MARGIN_BPS) {
      warnings.push({
        code: "THIN_MARGIN",
        severity: "warning",
        tierMinUnits: tier.minUnits,
        message: `Marge nette inférieure à 3 % au palier ${tier.minUnits}.`,
      });
    }
    if (tier.unitPrice >= referenceUnitPrice) {
      warnings.push({
        code: "NO_CUSTOMER_SAVING",
        severity: "warning",
        tierMinUnits: tier.minUnits,
        message: `Au palier ${tier.minUnits}, le prix CANARI n'est pas inférieur au prix de référence.`,
      });
    }
  }
  if (!referenceIsFresh) {
    warnings.push({
      code: "STALE_REFERENCE",
      severity: "blocking",
      message: "Le prix de référence a plus de 30 jours : faites un nouveau relevé avant de publier.",
    });
  }

  return { scenarios, warnings, requiresAcknowledgement: warnings.some((w) => w.severity === "blocking") };
}
