/**
 * PricingService : prix appliqués aux lignes (panier, devis, commande).
 * Une seule source de vérité pour que le prix affiché = le prix facturé.
 */
import type { GroupBuy, GroupBuyPortion, GroupBuyTier, ProductVariant, ReferencePrice } from "@prisma/client";
import { prorate } from "@/domain/money";
import { computeProgress, type GroupBuyState } from "@/domain/group-buy";
import { portionFractionationFee, portionPrice } from "@/domain/pricing";
import { usableReferencePrice } from "@/domain/reference-price";

export type GroupBuyWithTiers = GroupBuy & { tiers: GroupBuyTier[] };

export function toGroupBuyState(gb: GroupBuyWithTiers): GroupBuyState {
  return {
    status: gb.status,
    supplierUnitQuantityBase: gb.supplierUnitQuantityBase,
    targetUnits: gb.targetUnits,
    maxUnits: gb.maxUnits,
    committedBase: gb.committedBase,
    heldBase: gb.heldBase,
    participantCount: gb.participantCount,
    tiers: gb.tiers.map((t) => ({ minUnits: t.minUnits, unitPrice: t.unitPrice })),
    opensAt: gb.opensAt,
    closesAt: gb.closesAt,
    failurePolicy: gb.failurePolicy,
    extensionsUsed: gb.extensionsUsed,
    maxExtensions: gb.maxExtensions,
    extensionDays: gb.extensionDays,
  };
}

export interface LinePrice {
  unitPrice: number; // par portion / unité vendue, hors fractionnement
  fractionationFee: number; // par portion
  referenceUnitPrice: number; // référence utilisable, ou unitPrice si aucune (=> économie 0)
  referenceObservedAt: Date;
  referenceIsUsable: boolean;
  targetUnitPrice?: number; // prix de la portion si l'objectif est atteint
}

/** Prix d'une portion d'achat groupé au moment présent (plafond garanti). */
export function priceGroupPortion(gb: GroupBuyWithTiers, portion: Pick<GroupBuyPortion, "quantityBase">, now = new Date()): LinePrice {
  const progress = computeProgress(toGroupBuyState(gb));
  const unitPrice = portionPrice(progress.payableUnitPrice, portion.quantityBase, gb.supplierUnitQuantityBase);
  const fee = portionFractionationFee(portion.quantityBase, gb.supplierUnitQuantityBase, gb.fractionationFeePerPortion);
  const usable = usableReferencePrice(
    { price: gb.referenceUnitPrice, observedAt: gb.referenceObservedAt, source: gb.referenceSource, method: gb.referenceMethod },
    now,
  );
  return {
    unitPrice,
    fractionationFee: fee,
    // Méthode prudente : référence au prorata du conditionnement fournisseur (le détail est souvent plus cher au kg).
    referenceUnitPrice: usable !== null ? prorate(usable, portion.quantityBase, gb.supplierUnitQuantityBase) : unitPrice + fee,
    referenceObservedAt: gb.referenceObservedAt,
    referenceIsUsable: usable !== null,
    targetUnitPrice: portionPrice(progress.targetUnitPrice, portion.quantityBase, gb.supplierUnitQuantityBase),
  };
}

/** Prix d'une unité vendue en stock. */
export function priceVariant(variant: ProductVariant & { referencePrices: ReferencePrice[] }, now = new Date()): LinePrice | null {
  if (variant.canariPrice === null) return null;
  const ref = [...variant.referencePrices].sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())[0];
  const usable = ref ? usableReferencePrice({ price: ref.price, observedAt: ref.observedAt, source: ref.sourceLabel, method: ref.method }, now) : null;
  return {
    unitPrice: variant.canariPrice,
    fractionationFee: 0,
    referenceUnitPrice: usable ?? variant.canariPrice,
    referenceObservedAt: ref?.observedAt ?? now,
    referenceIsUsable: usable !== null,
  };
}
