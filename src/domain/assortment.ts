/**
 * Assortiment par phases.
 * Phase 1 (lancement) : uniquement des biens NON périssables (épicerie sèche,
 * entretien, hygiène, fournitures scolaires) — stockables, sans chaîne du froid,
 * avec peu de pertes : idéal pour fiabiliser l'agrégation et la logistique.
 * Phase 2 : ouverture des catégories périssables (frais, fruits & légumes)
 * une fois la rotation rapide et la chaîne du froid maîtrisées.
 */
import { DomainError } from "./errors";

export interface AssortmentConfig {
  perishablesEnabled: boolean;
}

export function isSellable(category: { isPerishable: boolean; isActive?: boolean }, config: AssortmentConfig): boolean {
  if (category.isActive === false) return false;
  return config.perishablesEnabled || !category.isPerishable;
}

export function assertSellable(category: { isPerishable: boolean; isActive?: boolean; name?: string }, config: AssortmentConfig): void {
  if (!isSellable(category, config)) {
    throw new DomainError(
      "INVALID_STATE",
      category.isPerishable
        ? "Les produits frais arrivent bientôt : Sesam-Market démarre avec les produits non périssables."
        : "Cette catégorie n'est pas disponible.",
    );
  }
}

/** Filtre Prisma réutilisable sur la catégorie d'un produit. */
export function sellableCategoryWhere(config: AssortmentConfig) {
  return config.perishablesEnabled ? { isActive: true } : { isActive: true, isPerishable: false };
}
