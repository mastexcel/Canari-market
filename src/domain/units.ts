/**
 * Unités physiques. Toutes les quantités sont stockées en unité de base entière :
 * gramme (GRAM), millilitre (MILLILITER) ou pièce (PIECE).
 */
export type BaseUnit = "GRAM" | "MILLILITER" | "PIECE";

const numberFr = (value: number, maxDigits = 2) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDigits }).format(value);

/** « 5 kg », « 500 g », « 1,5 L », « 30 pièces ». */
export function formatQuantity(quantityBase: number, unit: BaseUnit): string {
  switch (unit) {
    case "GRAM":
      if (Math.abs(quantityBase) >= 1_000_000) return `${numberFr(quantityBase / 1_000_000)} t`;
      if (Math.abs(quantityBase) >= 1000) return `${numberFr(quantityBase / 1000)} kg`;
      return `${numberFr(quantityBase)} g`;
    case "MILLILITER":
      if (Math.abs(quantityBase) >= 1000) return `${numberFr(quantityBase / 1000)} L`;
      return `${numberFr(quantityBase)} mL`;
    case "PIECE":
      return `${numberFr(quantityBase, 0)} ${Math.abs(quantityBase) > 1 ? "pièces" : "pièce"}`;
  }
}

/** Nombre d'unités fournisseur (décimal) correspondant à une quantité de base. */
export function toSupplierUnits(quantityBase: number, supplierUnitQuantityBase: number): number {
  return quantityBase / supplierUnitQuantityBase;
}

/** Arrondi d'affichage à une décimale, sans jamais afficher -0. */
export function roundUnits(units: number, digits = 1): number {
  const f = 10 ** digits;
  const r = Math.round(units * f) / f;
  return r === 0 ? 0 : r;
}

export function formatUnits(units: number, digits = 1): string {
  return numberFr(roundUnits(units, digits), digits);
}

/** Libellé d'unité de base pour les formulaires. */
export function baseUnitLabel(unit: BaseUnit): string {
  return unit === "GRAM" ? "g" : unit === "MILLILITER" ? "mL" : "pièce";
}

/**
 * Nom d'unité fournisseur accordé : unitNoun("Sac 50 kg", 2) → « sacs de 50 kg »,
 * unitNoun("Bidon 20 L", 1) → « bidon de 20 L ».
 */
export function unitNoun(label: string, count: number): string {
  const [first, ...rest] = label.trim().split(/\s+/);
  const word = first.toLowerCase();
  const plural = Math.abs(count) >= 2 && !/[sx]$/.test(word) ? `${word}s` : word;
  if (!rest.length) return plural;
  const tail = rest.join(" ");
  return /^(de|d'|du|des)\b/i.test(tail) ? `${plural} ${tail}` : `${plural} de ${tail}`;
}
