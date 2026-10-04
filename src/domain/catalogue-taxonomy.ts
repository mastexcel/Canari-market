/**
 * Arborescence du catalogue : 9 univers, chacun découpé en rayons.
 * Un produit est rangé dans le premier rayon de son univers dont un préfixe
 * correspond à son identifiant (slug). Les rayons sans produit s'affichent
 * « bientôt » : ils annoncent ce que Sesam-Market vendra.
 */

export interface Univers {
  slug: string;
  name: string;
  emoji: string;
  isPerishable: boolean;
}

export interface Rayon {
  slug: string;
  name: string;
  emoji: string;
  parent: string;
  /** Préfixes de slug produit rangés dans ce rayon. */
  match: readonly string[];
}

export const UNIVERS: readonly Univers[] = [
  { slug: "alimentation", name: "Épicerie sèche", emoji: "🍚", isPerishable: false },
  { slug: "boissons", name: "Boissons", emoji: "🧃", isPerishable: false },
  { slug: "entretien", name: "Entretien & maison", emoji: "🧴", isPerishable: false },
  { slug: "hygiene", name: "Hygiène, bébé & beauté", emoji: "🧼", isPerishable: false },
  { slug: "scolaire", name: "Fournitures scolaires", emoji: "🎒", isPerishable: false },
  { slug: "equipement", name: "Équipement & mode", emoji: "🏠", isPerishable: false },
  { slug: "construction", name: "Construction & bricolage", emoji: "🧱", isPerishable: false },
  { slug: "frais", name: "Frais & protéines", emoji: "🐟", isPerishable: true },
  { slug: "legumes", name: "Fruits & légumes", emoji: "🍅", isPerishable: true },
];

export const RAYONS: readonly Rayon[] = [
  // Épicerie sèche
  { slug: "riz-cereales", name: "Riz & céréales", emoji: "🌾", parent: "alimentation", match: ["riz-", "couscous", "semoule", "attieke", "gari", "haricots-secs", "lentilles", "pois-chiches", "arachides"] },
  { slug: "huiles-alimentaires", name: "Huiles alimentaires", emoji: "🫗", parent: "alimentation", match: ["huile-"] },
  { slug: "pates-alimentaires", name: "Pâtes alimentaires", emoji: "🍝", parent: "alimentation", match: ["spaghetti", "macaroni", "vermicelles"] },
  { slug: "farines", name: "Farines", emoji: "🌾", parent: "alimentation", match: ["farine-"] },
  { slug: "conserves", name: "Conserves", emoji: "🥫", parent: "alimentation", match: ["concentre-de-tomate", "haricots-blancs-en-conserve", "mais-doux", "petits-pois", "sardines", "thon"] },
  { slug: "sucre-edulcorants", name: "Sucre & édulcorants", emoji: "🍬", parent: "alimentation", match: ["sucre-", "miel"] },
  { slug: "sel-assaisonnements", name: "Sel & assaisonnements", emoji: "🧂", parent: "alimentation", match: ["sel-", "bouillon", "vinaigre", "mayonnaise", "pate-d-arachide"] },
  { slug: "epices-condiments", name: "Épices & condiments", emoji: "🌶️", parent: "alimentation", match: ["poivre", "piment-sec", "curry"] },
  { slug: "petit-dejeuner", name: "Petit déjeuner", emoji: "☕", parent: "alimentation", match: ["cafe-", "chocolat-en-poudre", "the-", "flocons", "lait-en-poudre", "lait-concentre", "lait-uht"] },
  { slug: "snacks-biscuits", name: "Snacks & biscuits", emoji: "🍪", parent: "alimentation", match: ["biscuits", "chips"] },
  { slug: "confiseries-chocolats", name: "Confiseries & chocolats", emoji: "🍫", parent: "alimentation", match: ["bonbons", "chocolat-noir", "chocolat-au-lait"] },
  { slug: "produits-en-gros", name: "Produits en gros", emoji: "📦", parent: "alimentation", match: [] },
  // Boissons
  { slug: "eaux-jus-sodas", name: "Eaux, jus & sodas", emoji: "🥤", parent: "boissons", match: ["eau-minerale", "jus-", "lait-de-coco", "sirop", "soda"] },
  // Entretien & maison
  { slug: "entretien-nettoyage", name: "Entretien & nettoyage", emoji: "🧽", parent: "entretien", match: ["eau-de-javel", "eponges", "insecticide", "lessive", "lingettes-menageres", "liquide-vaisselle", "nettoyant", "desodorisant", "sacs-poubelle", "savon-de-menage", "savon-liquide"] },
  { slug: "papiers-menagers", name: "Papiers ménagers", emoji: "🧻", parent: "entretien", match: ["mouchoirs", "papier-"] },
  { slug: "articles-maison-cuisine", name: "Articles de maison & cuisine", emoji: "🍳", parent: "entretien", match: ["allumettes", "bougies", "charbon", "petrole"] },
  // Hygiène, bébé & beauté
  { slug: "produits-bebe", name: "Produits bébé", emoji: "🍼", parent: "hygiene", match: ["couches", "lingettes-bebe", "cereales-bebe", "lait-infantile"] },
  { slug: "hygiene-personnelle", name: "Hygiène personnelle", emoji: "🧴", parent: "hygiene", match: ["brosses", "coton-tiges", "dentifrice", "deodorant", "gel-douche", "rasoirs", "savon-", "shampoing"] },
  { slug: "hygiene-feminine", name: "Hygiène féminine", emoji: "🌸", parent: "hygiene", match: ["serviettes-hygieniques"] },
  { slug: "beaute-cosmetiques", name: "Beauté & cosmétiques", emoji: "💄", parent: "hygiene", match: ["beurre-de-karite", "creme-", "parfum"] },
  // Fournitures scolaires
  { slug: "fournitures-scolaires", name: "Fournitures scolaires", emoji: "📚", parent: "scolaire", match: [""] },
  // Équipement & mode
  { slug: "petit-electromenager", name: "Petit électroménager", emoji: "🔌", parent: "equipement", match: [] },
  { slug: "gros-electromenager", name: "Gros électroménager", emoji: "🧊", parent: "equipement", match: [] },
  { slug: "telephonie-informatique", name: "Téléphonie & informatique", emoji: "📱", parent: "equipement", match: [] },
  { slug: "vetements-accessoires", name: "Vêtements & accessoires", emoji: "👗", parent: "equipement", match: [] },
  { slug: "sacs-bagages", name: "Sacs & bagages", emoji: "👜", parent: "equipement", match: [] },
  { slug: "jardinage-exterieur", name: "Jardinage & extérieur", emoji: "🪴", parent: "equipement", match: [] },
  { slug: "auto-moto", name: "Auto & moto", emoji: "🛵", parent: "equipement", match: [] },
  { slug: "animaux-compagnie", name: "Animaux de compagnie", emoji: "🐾", parent: "equipement", match: [] },
  // Construction & bricolage
  { slug: "materiaux-gros-oeuvre", name: "Matériaux de gros œuvre", emoji: "🏗️", parent: "construction", match: [] },
  { slug: "ferraillage-metaux", name: "Ferraillage & métaux", emoji: "🔩", parent: "construction", match: [] },
  { slug: "sable-gravier", name: "Sable, gravier & agrégats", emoji: "⛰️", parent: "construction", match: [] },
  { slug: "parpaings-briques", name: "Parpaings & briques", emoji: "🧱", parent: "construction", match: [] },
  { slug: "bois-menuiserie", name: "Bois & menuiserie", emoji: "🪵", parent: "construction", match: [] },
  { slug: "plomberie-sanitaire", name: "Plomberie & sanitaire", emoji: "🚰", parent: "construction", match: [] },
  { slug: "electricite-eclairage", name: "Électricité & éclairage", emoji: "💡", parent: "construction", match: [] },
  { slug: "peinture-finition", name: "Peinture & finition", emoji: "🎨", parent: "construction", match: [] },
  { slug: "outillage-quincaillerie", name: "Outillage & quincaillerie", emoji: "🛠️", parent: "construction", match: [] },
  { slug: "menuiserie-aluminium", name: "Menuiserie & aluminium", emoji: "🚪", parent: "construction", match: [] },
  { slug: "carrelage-revetements", name: "Carrelage & revêtements", emoji: "🔲", parent: "construction", match: [] },
  { slug: "toiture-couverture", name: "Toiture & couverture", emoji: "🏠", parent: "construction", match: [] },
  // Frais & protéines (phase 2)
  { slug: "viandes-volailles", name: "Viandes & volailles", emoji: "🥩", parent: "frais", match: ["cuisses-de-poulet", "poulet-", "viande-"] },
  { slug: "poissons-fruits-de-mer", name: "Poissons & fruits de mer", emoji: "🐟", parent: "frais", match: ["chinchard", "maquereau", "crevettes", "poisson-"] },
  { slug: "produits-laitiers", name: "Produits laitiers", emoji: "🧀", parent: "frais", match: ["fromage", "yaourt"] },
  { slug: "oeufs", name: "Œufs", emoji: "🥚", parent: "frais", match: ["ufs-", "oeufs-"] },
  { slug: "boulangerie-patisserie", name: "Boulangerie & pâtisserie", emoji: "🥖", parent: "frais", match: ["pain", "brioche"] },
  // Fruits & légumes (phase 2)
  { slug: "fruits", name: "Fruits", emoji: "🍍", parent: "legumes", match: ["ananas", "avocats", "oranges", "mangues", "bananes-douces"] },
  { slug: "legumes-frais", name: "Légumes", emoji: "🥕", parent: "legumes", match: [""] },
];

/** Rayon d'un produit dans son univers, ou null s'il n'en a pas (il reste dans l'univers). */
export function rayonFor(productSlug: string, universSlug: string): Rayon | null {
  return RAYONS.find((r) => r.parent === universSlug && r.match.some((m) => productSlug.startsWith(m))) ?? null;
}
