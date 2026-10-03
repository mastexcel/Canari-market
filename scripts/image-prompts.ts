/**
 * Génère docs/PROMPTS_IMAGES.md : les prompts ChatGPT pour TOUTES les images de
 * l'application, avec les noms de fichiers exacts attendus par le code.
 * Les prompts produits sont dérivés du catalogue de démo (prisma/seed-data.ts),
 * donc toujours synchronisés avec les slugs.
 * Usage : npm run images:prompts
 */
import { writeFileSync } from "node:fs";
import { CATEGORIES, PRODUCTS } from "../prisma/seed-data";
import { slugify } from "../src/domain/community";

const perishable = new Set<string>(CATEGORIES.filter((c) => c.isPerishable).map((c) => c.slug));

/** Même règle de slug que le seed (doublons suffixés par l'index). */
const seen = new Set<string>();
const rows = PRODUCTS.map((r, i) => {
  const [cat, name, brand, , unit, variant] = r;
  let slug = slugify(brand ? `${name} ${brand}` : name);
  if (seen.has(slug)) slug = `${slug}-${i}`;
  seen.add(slug);
  return { cat, name, brand, unit, variant, slug };
});

/** Indice de conditionnement lisible par le générateur d'images. */
function packaging(variant: string, unit: string): string {
  const v = variant.toLowerCase();
  if (v.startsWith("sac")) return `un sac tissé ou en papier kraft (${variant})`;
  if (v.startsWith("sachet")) return `un sachet souple refermable (${variant})`;
  if (v.startsWith("bidon")) return `un bidon en plastique avec poignée (${variant})`;
  if (v.startsWith("bouteille")) return `une bouteille (${variant})`;
  if (v.startsWith("boîte") || v.startsWith("boite")) return `une boîte (${variant})`;
  if (v.startsWith("pot")) return `un pot (${variant})`;
  if (v.startsWith("paquet")) return `un paquet (${variant})`;
  if (v.startsWith("brique")) return `une brique carton (${variant})`;
  if (v.startsWith("flacon")) return `un flacon (${variant})`;
  if (v.startsWith("aérosol")) return `un aérosol (${variant})`;
  if (v.startsWith("tube")) return `un tube (${variant})`;
  if (v.startsWith("pack")) return `un pack sous film (${variant})`;
  if (v.startsWith("lot")) return `un lot groupé (${variant})`;
  if (v.startsWith("kit")) return `un kit présenté de façon ordonnée (${variant})`;
  if (v.startsWith("rouleau")) return `un rouleau (${variant})`;
  return unit === "PIECE" ? `présentation : ${variant}` : `conditionnement : ${variant}`;
}

const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.name]));

const phase1 = rows.filter((r) => !perishable.has(r.cat));
const phase2 = rows.filter((r) => perishable.has(r.cat));

const productLines = (list: typeof rows, from: number) =>
  list
    .map((r, k) => `| ${from + k} | \`produits/${r.slug}.png\` | ${CAT_LABEL[r.cat]} | ${r.name} — ${packaging(r.variant, r.unit)} |`)
    .join("\n");

const md = `# Prompts ChatGPT — visuels Sesam-Market

> Document généré par \`npm run images:prompts\` à partir du catalogue. Ne pas modifier les
> noms de fichiers : l'application les détecte automatiquement.

**Positionnement à respecter dans TOUS les visuels :** Sesam-Market démarre avec les
**produits non périssables** (épicerie sèche, boissons, entretien, hygiène, fournitures
scolaires). Aucun produit frais (poisson, viande, œufs, fruits, légumes) ne doit apparaître
dans les visuels de la phase 1. Une section séparée prépare la phase 2 (frais), à générer plus tard.

---

## 0. Mode d'emploi

1. Ouvrez **une nouvelle conversation** ChatGPT (modèle avec génération d'images).
2. **Joignez le logo** Sesam-Market (le PNG officiel) comme référence de style et de couleurs.
3. Collez le **Bloc A — Charte visuelle** ci-dessous, une seule fois, et attendez la réponse « Compris ».
4. Demandez ensuite les images **une par une** (ou par 4 maximum), en recopiant le prompt de chaque ligne.
   Commencez toujours par : « Selon la charte Sesam-Market, génère : … ».
5. Téléchargez chaque image en **PNG**, renommez-la **exactement** comme indiqué
   (minuscules, tirets, sans accents) et rangez-la dans \`images-source/<dossier>/\`.
6. Lancez \`npm run images:optimize\` : conversion en WebP, redimensionnement, contrôle du poids,
   dépôt dans \`public/images/\`. L'application les affiche immédiatement (repli : pictogrammes).
7. **Vérifiez** chaque image : pas de texte inventé, pas de marque déposée, mains et visages corrects,
   orthographe exacte « Sesam-Market » quand le logo apparaît.

Conseil : si une série perd la cohérence, rappelez « Respecte strictement le Bloc A (charte) » dans le message.

---

## Bloc A — Charte visuelle (à coller une fois)

\`\`\`
Tu es le directeur artistique de Sesam-Market, centrale d'achat groupé en ligne pour les
ménages et petits commerces d'Abidjan (Côte d'Ivoire). Slogan : « À plusieurs, les prix
s'ouvrent. » Tous les visuels que je vais te demander doivent former UNE famille cohérente.

PALETTE (issue du logo joint) :
- Vert forêt (identité) #0E5F36, vert profond #063821
- Vert lime (dynamisme) #7CB82F, lime clair #9CCC3C
- Jaune soleil #FFBF1A, orange #F08A00 (accents, jamais dominants)
- Neutres : blanc, gris vert très clair #F3F6F2, texte #17241C

DEUX STYLES, selon ce que je demande :
1) « PACKSHOT » (produits) : photographie studio réaliste, haute définition, produit seul,
   centré, vue 3/4 légèrement plongeante, éclairage doux et diffus, ombre portée très légère
   au sol, FOND TRANSPARENT (PNG), cadrage carré 1:1 avec 8 % de marge. Emballage
   GÉNÉRIQUE et réaliste, SANS AUCUNE marque, logo ou texte lisible (utilise des étiquettes
   unies aux couleurs neutres ou de la palette). Couleurs fidèles, rendu appétissant et propre.
2) « ILLUSTRATION » (accueil, étapes, icônes, états) : illustration vectorielle 2.5D,
   formes arrondies, aplats et dégradés doux, légère texture, contours sans trait noir,
   palette ci-dessus, lumière chaude. Personnages : habitants d'Abidjan d'aujourd'hui
   (familles, commerçantes, jeunes actifs), tenues modernes et wax contemporain, expressions
   naturelles et souriantes, SANS clichés (pas de cases, pas de safari, pas de misère).
   Fond TRANSPARENT sauf indication contraire.

RÈGLES ABSOLUES :
- AUCUN texte, chiffre, lettre ou logo dans l'image (je l'ajoute dans l'application),
  sauf quand je demande explicitement le logo.
- AUCUN produit frais ou périssable (poisson, viande, œufs, fruits, légumes, pain) :
  nous commençons par le non-périssable (riz, huile, sucre, farine, pâtes, conserves,
  lait en poudre, savon, lessive, papier, cahiers…).
- Pas de marques réelles, pas de visages de personnes célèbres.
- Style homogène d'une image à l'autre : même lumière, même angle, même palette.
Réponds simplement « Compris » puis attends mes demandes.
\`\`\`

---

## Bloc B — Logo (ajustements)

> Un logo final se travaille idéalement en **vectoriel (SVG)** par un graphiste à partir du PNG
> officiel. Les prompts ci-dessous servent à obtenir des **déclinaisons de travail** cohérentes.
> Vérifiez toujours l'orthographe exacte : **Sesam-Market** (S et M majuscules, un tiret).

| Fichier (\`images-source/…\`) | Prompt |
|---|---|
| \`communication/logo-horizontal.png\` | Reprends exactement le logo joint (canari jaune, chariot vert, ailes vertes) en version **horizontale** : emblème à gauche, texte « Sesam-Market » à droite sur une ligne (« Sesam » vert forêt #0E5F36, tiret jaune #FFBF1A, « Market » dégradé lime #5F9E1B→#9CCC3C), police arrondie très grasse identique au logo, sans slogan ni pictogrammes. Fond transparent, format 4:1, lignes nettes, rendu vectoriel. |
| \`communication/logo-emblem.png\` | Uniquement l'**emblème** du logo joint (canari + chariot + ailes + traits de vitesse), sans aucun texte, centré, fond transparent, format carré 1:1, contours nets, couleurs identiques. |
| \`communication/logo-blanc.png\` | Version **monochrome blanche** du logo horizontal (emblème + « Sesam-Market »), pour fond vert foncé : formes pleines blanches, sans dégradé, fond transparent, format 4:1. |
| \`communication/icone-app.png\` | **Icône d'application** carrée 1:1 : l'emblème du logo (canari + chariot) centré sur un fond dégradé vert forêt #0E5F36 → #12773F avec une lueur jaune discrète en haut à droite, coins droits (le système arrondira), marge de sécurité de 18 %, aucun texte. |

Après validation, remplacez \`public/brand/mark.webp\` (emblème) et les icônes \`public/icons/*\` :
je peux régénérer automatiquement les tailles PWA à partir de \`icone-app.png\` et \`logo-emblem.png\`.

---

## Bloc C — Accueil, étapes, icônes, états, partage

| Fichier (\`images-source/…\`) | Format | Prompt (style ILLUSTRATION) |
|---|---|---|
| \`hero/accueil.png\` | 1:1, fond transparent | Un groupe de 4 voisins abidjanais souriants (une mère de famille, une commerçante, un jeune actif, un grand-père) réunis autour d'un **grand sac de riz de 50 kg**, de **bidons d'huile** et de **cartons de savon et de pâtes**, un petit canari jaune posé sur le sac. Composition compacte, lisible en petit sur fond vert foncé (contours clairs). |
| \`onboarding/etape-1.png\` | 1:1, transparent | « On s'unit » : plusieurs ménages d'un même quartier d'Abidjan, chacun avec son téléphone, des bulles reliées entre eux qui convergent vers un même panier ; ambiance chaleureuse. |
| \`onboarding/etape-2.png\` | 1:1, transparent | « Plus on est nombreux, moins on paie » : une pile de sacs de riz et de cartons qui grandit à côté d'une étiquette prix qui descend en escalier (flèche verte vers le bas), sans aucun chiffre. |
| \`onboarding/etape-3.png\` | 1:1, transparent | « Juste la quantité qu'il vous faut » : un grand sac de 50 kg partagé en petits sachets de 5, 10 et 25 kg alignés, une main qui en tend un à une cliente ; point relais en arrière-plan suggéré. |
| \`icones/achats-groupes.png\` | 1:1, transparent | Icône : trois silhouettes stylisées (vert, jaune, orange) épaule contre épaule, formes rondes, très simple, lisible à 36 px. |
| \`icones/livraison-domicile.png\` | 1:1, transparent | Icône : petit camion de livraison vert avec traits de vitesse jaunes, très simple, lisible à 36 px. |
| \`icones/points-relais.png\` | 1:1, transparent | Icône : épingle de localisation verte avec un cercle jaune au centre, très simple, lisible à 36 px. |
| \`icones/produits-pour-tous.png\` | 1:1, transparent | Icône : bouclier vert avec une coche blanche, très simple, lisible à 36 px. |
| \`etats/panier-vide.png\` | 1:1, transparent | Un panier en osier vide posé au sol, un petit canari jaune perché sur l'anse qui regarde avec curiosité ; ton doux et encourageant. |
| \`etats/aucune-commande.png\` | 1:1, transparent | Un carton de livraison fermé, vide, avec le canari jaune qui attend dessus ; ton optimiste. |
| \`etats/aucune-notification.png\` | 1:1, transparent | Une cloche de notification au repos avec le canari jaune endormi à côté ; ambiance calme. |
| \`communication/partage.png\` | **1200×630 (paysage), fond plein** | Visuel de partage WhatsApp/Facebook : à gauche un grand espace vert forêt uni (pour le texte ajouté plus tard), à droite les voisins du hero avec sacs de riz, bidons d'huile et cartons ; canari jaune ; aucun texte. |

---

## Bloc D — Catégories (phase 1, non périssable)

| Fichier | Format | Prompt (style PACKSHOT, composition de groupe) |
|---|---|---|
${CATEGORIES.filter((c) => !c.isPerishable)
  .map((c) => {
    const sujets: Record<string, string> = {
      alimentation: "un sac de riz, une bouteille d'huile, un paquet de sucre, un paquet de pâtes et deux conserves, emballages génériques",
      boissons: "un pack de bouteilles d'eau, une brique de jus et une bouteille de sirop rouge, emballages génériques",
      entretien: "un baril de lessive en poudre, des barres de savon de ménage, un flacon de liquide vaisselle et une bouteille de javel, emballages génériques",
      hygiene: "savons de toilette, tube de dentifrice, gel douche et un paquet de couches bébé, emballages génériques",
      scolaire: "une pile de cahiers colorés, des stylos, une règle, une ardoise et un sac à dos écolier",
    };
    return `| \`categories/${c.slug}.png\` | 3:2, fond transparent | Composition harmonieuse et compacte de ${sujets[c.slug] ?? c.name} — catégorie « ${c.name} ». |`;
  })
  .join("\n")}

---

## Bloc E — Produits phase 1 (${phase1.length} packshots non périssables)

Pour chaque ligne, envoyez :

\`\`\`
Selon la charte Sesam-Market (style PACKSHOT), génère le produit suivant :
<SUJET de la ligne>. Emballage générique réaliste sans marque ni texte lisible,
fond transparent, carré 1:1, même angle et même lumière que les précédents.
\`\`\`

> Les noms de marque du catalogue de démo (ex. Dinor, OMO) ne doivent **pas** apparaître :
> pour les vrais produits de marque, utilisez plus tard les photos officielles fournies par les fournisseurs.

| N° | Fichier (\`images-source/…\`) | Catégorie | Sujet |
|---|---|---|---|
${productLines(phase1, 1)}

---

## Bloc F — Phase 2 (frais) — à générer plus tard

À ne produire qu'à l'ouverture des produits frais (\`PERISHABLES_ENABLED="true"\`).
Pour ces visuels, la règle « aucun produit frais » de la charte est levée ; ajoutez au prompt :
« produit frais, aspect naturel et appétissant, sans gouttes artificielles ».

| Fichier | Prompt |
|---|---|
| \`categories/frais.png\` | Composition : poisson fumé, poulet emballé sous film, plateau d'œufs (style PACKSHOT). |
| \`categories/legumes.png\` | Composition : tomates, oignons, bananes plantain, piments, igname (style PACKSHOT). |
${phase2.map((r) => `| \`produits/${r.slug}.png\` | ${r.name} — ${packaging(r.variant, r.unit)} (style PACKSHOT, produit frais). |`).join("\n")}

---

## Récapitulatif

| Lot | Nombre | Dossier |
|---|---|---|
| Logo (déclinaisons) | 4 | \`communication/\` |
| Accueil, étapes, icônes, états, partage | 12 | \`hero/\`, \`onboarding/\`, \`icones/\`, \`etats/\`, \`communication/\` |
| Catégories phase 1 | ${CATEGORIES.filter((c) => !c.isPerishable).length} | \`categories/\` |
| Produits phase 1 | ${phase1.length} | \`produits/\` |
| Phase 2 (plus tard) | ${phase2.length + 2} | \`produits/\`, \`categories/\` |

Poids cible après \`npm run images:optimize\` : produits ≤ 40 ko, illustrations ≤ 60 ko.
`;

writeFileSync("docs/PROMPTS_IMAGES.md", md);
console.log(`docs/PROMPTS_IMAGES.md généré : ${phase1.length} produits phase 1, ${phase2.length} produits phase 2.`);
