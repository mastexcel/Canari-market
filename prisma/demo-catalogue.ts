/**
 * Démonstration : premiers produits des rayons ouverts avec le catalogue étendu
 * (construction, équipement, produits en gros…). Prix en FCFA, FICTIFS mais plausibles.
 * Idempotent : un produit déjà présent (même slug) n'est jamais recréé ni modifié.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { Db } from "../src/infrastructure/db";
import { slugify } from "../src/domain/community";

type Unit = "GRAM" | "MILLILITER" | "PIECE";
/** [rayon, nom, marque, emoji, unité, libellé, quantité, poids g, prix Sesam-Market, prix de référence] */
type Row = [string, string, string | null, string, Unit, string, number, number, number, number];

export const DEMO_EXTENDED: Row[] = [
  // Construction & bricolage
  ["materiaux-gros-oeuvre", "Ciment CPJ 42.5", "Cimaf", "🏗️", "GRAM", "Sac 50 kg", 50_000, 50_000, 5_200, 5_700],
  ["materiaux-gros-oeuvre", "Chaux hydraulique", null, "🏗️", "GRAM", "Sac 25 kg", 25_000, 25_000, 3_500, 3_950],
  ["ferraillage-metaux", "Fer à béton HA10", null, "🔩", "PIECE", "Barre de 12 m", 1, 7_400, 3_100, 3_450],
  ["ferraillage-metaux", "Fil d'attache recuit", null, "🔩", "GRAM", "Rouleau 2 kg", 2_000, 2_000, 2_400, 2_800],
  ["sable-gravier", "Sable lagunaire", null, "⛰️", "PIECE", "Chargement 1 m³", 1, 1_500_000, 18_000, 21_000],
  ["sable-gravier", "Gravier concassé 15/25", null, "⛰️", "PIECE", "Chargement 1 m³", 1, 1_600_000, 28_000, 32_000],
  ["parpaings-briques", "Parpaing creux 15 cm", null, "🧱", "PIECE", "Lot de 100", 100, 1_700_000, 45_000, 52_000],
  ["parpaings-briques", "Brique rouge pleine", null, "🧱", "PIECE", "Lot de 100", 100, 250_000, 25_000, 29_000],
  ["bois-menuiserie", "Planche de coffrage", null, "🪵", "PIECE", "Longueur 4 m", 1, 9_000, 2_200, 2_550],
  ["bois-menuiserie", "Chevron 6 x 8", null, "🪵", "PIECE", "Longueur 4 m", 1, 11_000, 2_800, 3_250],
  ["plomberie-sanitaire", "Tuyau PVC évacuation 100 mm", null, "🚰", "PIECE", "Longueur 4 m", 1, 6_000, 6_500, 7_500],
  ["plomberie-sanitaire", "Robinet mélangeur évier", null, "🚰", "PIECE", "À l'unité", 1, 1_200, 9_500, 11_500],
  ["electricite-eclairage", "Câble électrique 2,5 mm²", null, "💡", "PIECE", "Couronne 100 m", 1, 3_500, 32_000, 37_000],
  ["electricite-eclairage", "Ampoule LED 12 W", null, "💡", "PIECE", "Lot de 6", 6, 400, 4_500, 5_400],
  ["peinture-finition", "Peinture à eau mate blanche", null, "🎨", "GRAM", "Seau 25 kg", 25_000, 25_000, 18_000, 21_000],
  ["peinture-finition", "Kit rouleau et bac", null, "🎨", "PIECE", "Kit complet", 1, 800, 3_500, 4_200],
  ["outillage-quincaillerie", "Brouette de chantier 90 L", null, "🛠️", "PIECE", "À l'unité", 1, 16_000, 28_000, 32_500],
  ["outillage-quincaillerie", "Marteau de coffreur", null, "🛠️", "PIECE", "À l'unité", 1, 700, 4_500, 5_300],
  ["menuiserie-aluminium", "Fenêtre aluminium coulissante 120 x 100", null, "🚪", "PIECE", "À l'unité", 1, 18_000, 75_000, 86_000],
  ["menuiserie-aluminium", "Porte isoplane 80 cm", null, "🚪", "PIECE", "Avec cadre", 1, 22_000, 38_000, 44_000],
  ["carrelage-revetements", "Carreau de sol 60 x 60", null, "🔲", "PIECE", "Carton de 1,44 m²", 4, 32_000, 9_500, 11_000],
  ["carrelage-revetements", "Colle carrelage", null, "🔲", "GRAM", "Sac 25 kg", 25_000, 25_000, 5_500, 6_300],
  ["toiture-couverture", "Tôle bac aluminium", null, "🏠", "PIECE", "Longueur 3 m", 1, 4_500, 7_500, 8_600],
  ["toiture-couverture", "Pointes de toiture", null, "🏠", "GRAM", "Boîte 1 kg", 1_000, 1_000, 1_500, 1_800],
  // Équipement & mode
  ["petit-electromenager", "Mixeur blender 1,5 L", null, "🔌", "PIECE", "À l'unité", 1, 2_500, 18_000, 22_000],
  ["petit-electromenager", "Cuiseur à riz 1,8 L", null, "🔌", "PIECE", "À l'unité", 1, 3_000, 22_000, 26_000],
  ["gros-electromenager", "Réfrigérateur 200 L", null, "🧊", "PIECE", "À l'unité", 1, 45_000, 185_000, 215_000],
  ["gros-electromenager", "Cuisinière 4 feux à gaz", null, "🧊", "PIECE", "À l'unité", 1, 38_000, 145_000, 168_000],
  ["telephonie-informatique", "Smartphone 6,5 pouces 128 Go", null, "📱", "PIECE", "À l'unité", 1, 400, 85_000, 99_000],
  ["telephonie-informatique", "Batterie externe 20 000 mAh", null, "📱", "PIECE", "À l'unité", 1, 450, 12_000, 14_500],
  ["vetements-accessoires", "Pagne wax", null, "👗", "PIECE", "Pièce de 6 yards", 1, 900, 9_000, 11_000],
  ["vetements-accessoires", "Tee-shirt coton", null, "👗", "PIECE", "Lot de 3", 3, 600, 7_500, 9_000],
  ["sacs-bagages", "Valise cabine", null, "👜", "PIECE", "À l'unité", 1, 3_000, 25_000, 29_500],
  ["sacs-bagages", "Sac à main", null, "👜", "PIECE", "À l'unité", 1, 800, 15_000, 18_000],
  ["jardinage-exterieur", "Arrosoir 10 L", null, "🪴", "PIECE", "À l'unité", 1, 900, 3_500, 4_200],
  ["jardinage-exterieur", "Terreau universel", null, "🪴", "PIECE", "Sac 40 L", 1, 15_000, 4_500, 5_200],
  ["auto-moto", "Huile moteur 4 temps", null, "🛵", "MILLILITER", "Bidon 1 L", 1_000, 950, 4_500, 5_200],
  ["auto-moto", "Casque moto homologué", null, "🛵", "PIECE", "À l'unité", 1, 1_400, 18_000, 21_000],
  ["animaux-compagnie", "Croquettes chien adulte", null, "🐾", "GRAM", "Sac 10 kg", 10_000, 10_000, 15_000, 17_500],
  ["animaux-compagnie", "Croquettes chat", null, "🐾", "GRAM", "Sac 4 kg", 4_000, 4_000, 9_000, 10_500],
  // Épicerie sèche
  ["produits-en-gros", "Huile végétale, carton de 12 bouteilles", null, "📦", "MILLILITER", "Carton 12 x 1 L", 12_000, 12_000, 15_500, 17_500],
  ["produits-en-gros", "Sucre en poudre, sac de 50 kg", null, "📦", "GRAM", "Sac 50 kg", 50_000, 50_000, 34_000, 38_000],
  ["confiseries-chocolats", "Bonbons assortis", null, "🍬", "GRAM", "Sachet 1 kg", 1_000, 1_000, 3_500, 4_200],
  ["confiseries-chocolats", "Chocolat au lait en tablettes", null, "🍫", "GRAM", "Lot de 10 x 100 g", 1_000, 1_000, 6_000, 7_000],
];

const DAY = 86_400_000;

/** Ajoute les produits manquants ; retourne le nombre de produits créés. */
export async function seedDemoExtendedCatalogue(db: Db, publicDir = path.join(process.cwd(), "public")): Promise<number> {
  const rayons = new Map((await db.category.findMany({ select: { id: true, slug: true } })).map((c) => [c.slug, c.id]));
  const warehouse = await db.warehouse.findFirst({ orderBy: { createdAt: "asc" } });
  const skuBase = await db.productVariant.count();
  let created = 0;
  for (const [i, [rayon, name, brand, emoji, unit, label, qty, weight, price, ref]] of DEMO_EXTENDED.entries()) {
    const slug = slugify(brand ? `${name} ${brand}` : name);
    const categoryId = rayons.get(rayon);
    if (!categoryId || (await db.product.findUnique({ where: { slug } }))) continue;
    const product = await db.product.create({
      data: {
        slug,
        name,
        brand,
        emoji,
        baseUnit: unit,
        categoryId,
        description: `${name}${brand ? ` de marque ${brand}` : ""}, sélectionné par Sesam-Market auprès de fournisseurs vérifiés.`,
        popularity: 20 + ((i * 37) % 60),
        variants: { create: { sku: `SKU-X${String(skuBase + i + 1).padStart(3, "0")}`, name: label, quantityBase: qty, weightGrams: weight, canariPrice: price } },
      },
      include: { variants: true },
    });
    const v = product.variants[0];
    const now = Date.now();
    await db.referencePrice.createMany({
      data: [
        { variantId: v.id, price: Math.round((ref * 1.03) / 25) * 25, source: "MARKET_SURVEY", sourceLabel: "Relevé Sesam-Market, quincailleries et marchés d'Adjamé", method: "Médiane de 3 relevés", observedAt: new Date(now - 30 * DAY) },
        { variantId: v.id, price: ref, source: "RETAILER_PRICE", sourceLabel: "Prix affiché en magasin (Abidjan)", method: "Médiane de 3 relevés", observedAt: new Date(now - (3 + (i % 12)) * DAY) },
      ],
    });
    if (warehouse) await db.inventory.create({ data: { warehouseId: warehouse.id, productId: product.id, quantityBase: qty * (20 + (i % 30)) } });
    // Visuel : la photo du rayon, en attendant une photo propre au produit
    const from = path.join(publicDir, "images/sous-categories", `${rayon}.webp`);
    const to = path.join(publicDir, "images/produits", `${slug}.webp`);
    if (existsSync(from) && !existsSync(to)) {
      mkdirSync(path.dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
    created++;
  }
  return created;
}
