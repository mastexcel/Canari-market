# Prompts ChatGPT — visuels Sesam-Market

> Document généré par `npm run images:prompts` à partir du catalogue. Ne pas modifier les
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
   (minuscules, tirets, sans accents) et rangez-la dans `images-source/<dossier>/`.
6. Lancez `npm run images:optimize` : conversion en WebP, redimensionnement, contrôle du poids,
   dépôt dans `public/images/`. L'application les affiche immédiatement (repli : pictogrammes).
7. **Vérifiez** chaque image : pas de texte inventé, pas de marque déposée, mains et visages corrects,
   orthographe exacte « Sesam-Market » quand le logo apparaît.

Conseil : si une série perd la cohérence, rappelez « Respecte strictement le Bloc A (charte) » dans le message.

---

## Bloc A — Charte visuelle (à coller une fois)

```
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
```

---

## Bloc B — Logo (ajustements)

> Un logo final se travaille idéalement en **vectoriel (SVG)** par un graphiste à partir du PNG
> officiel. Les prompts ci-dessous servent à obtenir des **déclinaisons de travail** cohérentes.
> Vérifiez toujours l'orthographe exacte : **Sesam-Market** (S et M majuscules, un tiret).

| Fichier (`images-source/…`) | Prompt |
|---|---|
| `communication/logo-horizontal.png` | Reprends exactement le logo joint (canari jaune, chariot vert, ailes vertes) en version **horizontale** : emblème à gauche, texte « Sesam-Market » à droite sur une ligne (« Sesam » vert forêt #0E5F36, tiret jaune #FFBF1A, « Market » dégradé lime #5F9E1B→#9CCC3C), police arrondie très grasse identique au logo, sans slogan ni pictogrammes. Fond transparent, format 4:1, lignes nettes, rendu vectoriel. |
| `communication/logo-emblem.png` | Uniquement l'**emblème** du logo joint (canari + chariot + ailes + traits de vitesse), sans aucun texte, centré, fond transparent, format carré 1:1, contours nets, couleurs identiques. |
| `communication/logo-blanc.png` | Version **monochrome blanche** du logo horizontal (emblème + « Sesam-Market »), pour fond vert foncé : formes pleines blanches, sans dégradé, fond transparent, format 4:1. |
| `communication/icone-app.png` | **Icône d'application** carrée 1:1 : l'emblème du logo (canari + chariot) centré sur un fond dégradé vert forêt #0E5F36 → #12773F avec une lueur jaune discrète en haut à droite, coins droits (le système arrondira), marge de sécurité de 18 %, aucun texte. |

Après validation, remplacez `public/brand/mark.webp` (emblème) et les icônes `public/icons/*` :
je peux régénérer automatiquement les tailles PWA à partir de `icone-app.png` et `logo-emblem.png`.

---

## Bloc C — Accueil, étapes, icônes, états, partage

| Fichier (`images-source/…`) | Format | Prompt (style ILLUSTRATION) |
|---|---|---|
| `hero/accueil.png` | 1:1, fond transparent | Un groupe de 4 voisins abidjanais souriants (une mère de famille, une commerçante, un jeune actif, un grand-père) réunis autour d'un **grand sac de riz de 50 kg**, de **bidons d'huile** et de **cartons de savon et de pâtes**, un petit canari jaune posé sur le sac. Composition compacte, lisible en petit sur fond vert foncé (contours clairs). |
| `onboarding/etape-1.png` | 1:1, transparent | « On s'unit » : plusieurs ménages d'un même quartier d'Abidjan, chacun avec son téléphone, des bulles reliées entre eux qui convergent vers un même panier ; ambiance chaleureuse. |
| `onboarding/etape-2.png` | 1:1, transparent | « Plus on est nombreux, moins on paie » : une pile de sacs de riz et de cartons qui grandit à côté d'une étiquette prix qui descend en escalier (flèche verte vers le bas), sans aucun chiffre. |
| `onboarding/etape-3.png` | 1:1, transparent | « Juste la quantité qu'il vous faut » : un grand sac de 50 kg partagé en petits sachets de 5, 10 et 25 kg alignés, une main qui en tend un à une cliente ; point relais en arrière-plan suggéré. |
| `icones/achats-groupes.png` | 1:1, transparent | Icône : trois silhouettes stylisées (vert, jaune, orange) épaule contre épaule, formes rondes, très simple, lisible à 36 px. |
| `icones/livraison-domicile.png` | 1:1, transparent | Icône : petit camion de livraison vert avec traits de vitesse jaunes, très simple, lisible à 36 px. |
| `icones/points-relais.png` | 1:1, transparent | Icône : épingle de localisation verte avec un cercle jaune au centre, très simple, lisible à 36 px. |
| `icones/produits-pour-tous.png` | 1:1, transparent | Icône : bouclier vert avec une coche blanche, très simple, lisible à 36 px. |
| `etats/panier-vide.png` | 1:1, transparent | Un panier en osier vide posé au sol, un petit canari jaune perché sur l'anse qui regarde avec curiosité ; ton doux et encourageant. |
| `etats/aucune-commande.png` | 1:1, transparent | Un carton de livraison fermé, vide, avec le canari jaune qui attend dessus ; ton optimiste. |
| `etats/aucune-notification.png` | 1:1, transparent | Une cloche de notification au repos avec le canari jaune endormi à côté ; ambiance calme. |
| `communication/partage.png` | **1200×630 (paysage), fond plein** | Visuel de partage WhatsApp/Facebook : à gauche un grand espace vert forêt uni (pour le texte ajouté plus tard), à droite les voisins du hero avec sacs de riz, bidons d'huile et cartons ; canari jaune ; aucun texte. |

---

## Bloc D — Catégories (phase 1, non périssable)

| Fichier | Format | Prompt (style PACKSHOT, composition de groupe) |
|---|---|---|
| `categories/alimentation.png` | 3:2, fond transparent | Composition harmonieuse et compacte de un sac de riz, une bouteille d'huile, un paquet de sucre, un paquet de pâtes et deux conserves, emballages génériques — catégorie « Épicerie sèche ». |
| `categories/boissons.png` | 3:2, fond transparent | Composition harmonieuse et compacte de un pack de bouteilles d'eau, une brique de jus et une bouteille de sirop rouge, emballages génériques — catégorie « Boissons ». |
| `categories/entretien.png` | 3:2, fond transparent | Composition harmonieuse et compacte de un baril de lessive en poudre, des barres de savon de ménage, un flacon de liquide vaisselle et une bouteille de javel, emballages génériques — catégorie « Entretien ». |
| `categories/hygiene.png` | 3:2, fond transparent | Composition harmonieuse et compacte de savons de toilette, tube de dentifrice, gel douche et un paquet de couches bébé, emballages génériques — catégorie « Hygiène & bébé ». |
| `categories/scolaire.png` | 3:2, fond transparent | Composition harmonieuse et compacte de une pile de cahiers colorés, des stylos, une règle, une ardoise et un sac à dos écolier — catégorie « Fournitures scolaires ». |

---

## Bloc E — Produits phase 1 (101 packshots non périssables)

Pour chaque ligne, envoyez :

```
Selon la charte Sesam-Market (style PACKSHOT), génère le produit suivant :
<SUJET de la ligne>. Emballage générique réaliste sans marque ni texte lisible,
fond transparent, carré 1:1, même angle et même lumière que les précédents.
```

> Les noms de marque du catalogue de démo (ex. Dinor, OMO) ne doivent **pas** apparaître :
> pour les vrais produits de marque, utilisez plus tard les photos officielles fournies par les fournisseurs.

| N° | Fichier (`images-source/…`) | Catégorie | Sujet |
|---|---|---|---|
| 1 | `produits/riz-parfume-long-grain-dinor.png` | Épicerie sèche | Riz parfumé long grain — un sac tissé ou en papier kraft (Sac 5 kg) |
| 2 | `produits/riz-brise-25-uncle-sam.png` | Épicerie sèche | Riz brisé 25 % — un sac tissé ou en papier kraft (Sac 5 kg) |
| 3 | `produits/riz-local-bouake-coop-gbeke.png` | Épicerie sèche | Riz local Bouaké — un sac tissé ou en papier kraft (Sac 5 kg) |
| 4 | `produits/riz-parfume-premium-meme.png` | Épicerie sèche | Riz parfumé premium — un sac tissé ou en papier kraft (Sac 10 kg) |
| 5 | `produits/huile-de-palme-raffinee-dinor.png` | Épicerie sèche | Huile de palme raffinée — un bidon en plastique avec poignée (Bidon 5 L) |
| 6 | `produits/huile-de-palme-raffinee-aya.png` | Épicerie sèche | Huile de palme raffinée — une bouteille (Bouteille 1 L) |
| 7 | `produits/huile-d-arachide-lesieur.png` | Épicerie sèche | Huile d'arachide — une bouteille (Bouteille 1 L) |
| 8 | `produits/sucre-en-poudre-sucaf.png` | Épicerie sèche | Sucre en poudre — un sac tissé ou en papier kraft (Sac 1 kg) |
| 9 | `produits/sucre-en-morceaux-sucrivoire.png` | Épicerie sèche | Sucre en morceaux — une boîte (Boîte 1 kg) |
| 10 | `produits/farine-de-ble-grands-moulins-d-abidjan.png` | Épicerie sèche | Farine de blé — un sac tissé ou en papier kraft (Sac 1 kg) |
| 11 | `produits/farine-de-mais-coop-korhogo.png` | Épicerie sèche | Farine de maïs — un sac tissé ou en papier kraft (Sac 2 kg) |
| 12 | `produits/lait-en-poudre-entier-nido.png` | Épicerie sèche | Lait en poudre entier — une boîte (Boîte 400 g) |
| 13 | `produits/lait-concentre-sucre-bonnet-rouge.png` | Épicerie sèche | Lait concentré sucré — une boîte (Boîte 397 g) |
| 14 | `produits/lait-uht-demi-ecreme-candia.png` | Épicerie sèche | Lait UHT demi-écrémé — une brique carton (Brique 1 L) |
| 15 | `produits/spaghetti-pastaco.png` | Épicerie sèche | Spaghetti — un paquet (Paquet 500 g) |
| 16 | `produits/macaroni-pastaco.png` | Épicerie sèche | Macaroni — un paquet (Paquet 500 g) |
| 17 | `produits/concentre-de-tomate-gino.png` | Épicerie sèche | Concentré de tomate — une boîte (Boîte 400 g) |
| 18 | `produits/bouillon-cube-maggi.png` | Épicerie sèche | Bouillon cube — une boîte (Boîte de 100) |
| 19 | `produits/sel-iode-sel-du-sud.png` | Épicerie sèche | Sel iodé — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 20 | `produits/attieke-sec-coop-dabou.png` | Épicerie sèche | Attiéké sec — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 21 | `produits/gari-coop-dabou.png` | Épicerie sèche | Gari — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 22 | `produits/haricots-secs.png` | Épicerie sèche | Haricots secs — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 23 | `produits/arachides-decortiquees.png` | Épicerie sèche | Arachides décortiquées — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 24 | `produits/cafe-moulu-cafe-cacao-ci.png` | Épicerie sèche | Café moulu — un paquet (Paquet 250 g) |
| 25 | `produits/chocolat-en-poudre-cao-lait.png` | Épicerie sèche | Chocolat en poudre — une boîte (Boîte 500 g) |
| 26 | `produits/sardines-a-l-huile-peche-ci.png` | Épicerie sèche | Sardines à l'huile — une boîte (Boîte 125 g) |
| 27 | `produits/mayonnaise-calve.png` | Épicerie sèche | Mayonnaise — un pot (Pot 500 g) |
| 28 | `produits/vinaigre.png` | Épicerie sèche | Vinaigre — une bouteille (Bouteille 1 L) |
| 29 | `produits/semoule-de-mais.png` | Épicerie sèche | Semoule de maïs — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 30 | `produits/flocons-d-avoine-quaker.png` | Épicerie sèche | Flocons d'avoine — une boîte (Boîte 500 g) |
| 31 | `produits/lessive-en-poudre-omo.png` | Entretien | Lessive en poudre — un sac tissé ou en papier kraft (Sac 3 kg) |
| 32 | `produits/lessive-en-poudre-kalia.png` | Entretien | Lessive en poudre — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 33 | `produits/savon-de-menage-savon-le-coq.png` | Entretien | Savon de ménage — un lot groupé (Lot de 6 barres) |
| 34 | `produits/liquide-vaisselle-mama-ivoire.png` | Entretien | Liquide vaisselle — un flacon (Flacon 1 L) |
| 35 | `produits/eau-de-javel-la-croix.png` | Entretien | Eau de Javel — une bouteille (Bouteille 1 L) |
| 36 | `produits/papier-hygienique-lotus.png` | Entretien | Papier hygiénique — un paquet (Paquet de 12) |
| 37 | `produits/eponges-grattantes.png` | Entretien | Éponges grattantes — un lot groupé (Lot de 5) |
| 38 | `produits/insecticide-rambo.png` | Entretien | Insecticide — un aérosol (Aérosol 400 mL) |
| 39 | `produits/nettoyant-multi-surfaces-saint-marc.png` | Entretien | Nettoyant multi-surfaces — un flacon (Flacon 1 L) |
| 40 | `produits/sacs-poubelle-50-l.png` | Entretien | Sacs poubelle 50 L — un rouleau (Rouleau de 20) |
| 41 | `produits/allumettes.png` | Entretien | Allumettes — un paquet (Paquet de 10 boîtes) |
| 42 | `produits/bougies.png` | Entretien | Bougies — un paquet (Paquet de 8) |
| 43 | `produits/charbon-de-bois.png` | Entretien | Charbon de bois — un sac tissé ou en papier kraft (Sac 10 kg) |
| 44 | `produits/petrole-lampant.png` | Entretien | Pétrole lampant — un bidon en plastique avec poignée (Bidon 1 L) |
| 45 | `produits/lingettes-menageres.png` | Entretien | Lingettes ménagères — un paquet (Paquet de 40) |
| 46 | `produits/savon-de-toilette-lux.png` | Hygiène & bébé | Savon de toilette — un lot groupé (Lot de 4) |
| 47 | `produits/savon-antibacterien-protex.png` | Hygiène & bébé | Savon antibactérien — un lot groupé (Lot de 3) |
| 48 | `produits/dentifrice-signal.png` | Hygiène & bébé | Dentifrice — un tube (Tube 100 mL) |
| 49 | `produits/brosses-a-dents-colgate.png` | Hygiène & bébé | Brosses à dents — un lot groupé (Lot de 4) |
| 50 | `produits/serviettes-hygieniques-always.png` | Hygiène & bébé | Serviettes hygiéniques — un paquet (Paquet de 16) |
| 51 | `produits/serviettes-hygieniques-lavables-coop-femmes-d-abobo.png` | Hygiène & bébé | Serviettes hygiéniques lavables — un kit présenté de façon ordonnée (Kit de 4) |
| 52 | `produits/couches-bebe-taille-3-pampers.png` | Hygiène & bébé | Couches bébé taille 3 — un paquet (Paquet de 44) |
| 53 | `produits/couches-bebe-taille-4-molfix.png` | Hygiène & bébé | Couches bébé taille 4 — un paquet (Paquet de 40) |
| 54 | `produits/lingettes-bebe-pampers.png` | Hygiène & bébé | Lingettes bébé — un paquet (Paquet de 64) |
| 55 | `produits/lait-infantile-1er-age-guigoz.png` | Hygiène & bébé | Lait infantile 1er âge — une boîte (Boîte 400 g) |
| 56 | `produits/cereales-bebe-cerelac.png` | Hygiène & bébé | Céréales bébé — une boîte (Boîte 400 g) |
| 57 | `produits/deodorant-rexona.png` | Hygiène & bébé | Déodorant — un aérosol (Aérosol 150 mL) |
| 58 | `produits/gel-douche-palmolive.png` | Hygiène & bébé | Gel douche — un flacon (Flacon 500 mL) |
| 59 | `produits/beurre-de-karite-coop-korhogo.png` | Hygiène & bébé | Beurre de karité — un pot (Pot 250 g) |
| 60 | `produits/coton-tiges.png` | Hygiène & bébé | Coton-tiges — une boîte (Boîte de 200) |
| 61 | `produits/cahiers-100-pages-clairefontaine.png` | Fournitures scolaires | Cahiers 100 pages — un lot groupé (Lot de 10) |
| 62 | `produits/cahiers-200-pages-conquerant.png` | Fournitures scolaires | Cahiers 200 pages — un lot groupé (Lot de 5) |
| 63 | `produits/stylos-a-bille-bleus-bic.png` | Fournitures scolaires | Stylos à bille bleus — une boîte (Boîte de 20) |
| 64 | `produits/crayons-a-papier-bic.png` | Fournitures scolaires | Crayons à papier — une boîte (Boîte de 12) |
| 65 | `produits/gommes.png` | Fournitures scolaires | Gommes — un lot groupé (Lot de 10) |
| 66 | `produits/regles-30-cm.png` | Fournitures scolaires | Règles 30 cm — un lot groupé (Lot de 5) |
| 67 | `produits/sac-a-dos-ecolier.png` | Fournitures scolaires | Sac à dos écolier — présentation : Pièce |
| 68 | `produits/kit-scolaire-primaire-sesam-market.png` | Fournitures scolaires | Kit scolaire primaire — un kit présenté de façon ordonnée (Kit complet) |
| 69 | `produits/kit-scolaire-college-sesam-market.png` | Fournitures scolaires | Kit scolaire collège — un kit présenté de façon ordonnée (Kit complet) |
| 70 | `produits/ardoises.png` | Fournitures scolaires | Ardoises — un lot groupé (Lot de 5) |
| 71 | `produits/craies-blanches.png` | Fournitures scolaires | Craies blanches — une boîte (Boîte de 100) |
| 72 | `produits/protege-cahiers.png` | Fournitures scolaires | Protège-cahiers — un lot groupé (Lot de 10) |
| 73 | `produits/calculatrice-casio.png` | Fournitures scolaires | Calculatrice — présentation : Pièce |
| 74 | `produits/crayons-de-couleur-maped.png` | Fournitures scolaires | Crayons de couleur — une boîte (Boîte de 12) |
| 75 | `produits/thon-a-l-huile.png` | Épicerie sèche | Thon à l'huile — une boîte (Boîte 160 g) |
| 76 | `produits/petits-pois-en-conserve.png` | Épicerie sèche | Petits pois en conserve — une boîte (Boîte 400 g) |
| 77 | `produits/haricots-blancs-en-conserve.png` | Épicerie sèche | Haricots blancs en conserve — une boîte (Boîte 400 g) |
| 78 | `produits/mais-doux-en-conserve.png` | Épicerie sèche | Maïs doux en conserve — une boîte (Boîte 300 g) |
| 79 | `produits/lentilles.png` | Épicerie sèche | Lentilles — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 80 | `produits/pois-chiches.png` | Épicerie sèche | Pois chiches — un sac tissé ou en papier kraft (Sachet 1 kg) |
| 81 | `produits/couscous.png` | Épicerie sèche | Couscous — un paquet (Paquet 1 kg) |
| 82 | `produits/vermicelles.png` | Épicerie sèche | Vermicelles — un paquet (Paquet 500 g) |
| 83 | `produits/huile-de-soja.png` | Épicerie sèche | Huile de soja — une bouteille (Bouteille 1 L) |
| 84 | `produits/biscuits-secs.png` | Épicerie sèche | Biscuits secs — un paquet (Paquet 400 g) |
| 85 | `produits/miel-coop-korhogo.png` | Épicerie sèche | Miel — un pot (Pot 500 g) |
| 86 | `produits/pate-d-arachide.png` | Épicerie sèche | Pâte d'arachide — un pot (Pot 500 g) |
| 87 | `produits/poivre-noir-moulu.png` | Épicerie sèche | Poivre noir moulu — un sac tissé ou en papier kraft (Sachet 100 g) |
| 88 | `produits/the-noir.png` | Épicerie sèche | Thé noir — une boîte (Boîte de 25 sachets) |
| 89 | `produits/eau-minerale.png` | Boissons | Eau minérale — un pack sous film (Pack 6 × 1,5 L) |
| 90 | `produits/jus-de-fruits-uht.png` | Boissons | Jus de fruits UHT — une brique carton (Brique 1 L) |
| 91 | `produits/sirop-de-bissap.png` | Boissons | Sirop de bissap — une bouteille (Bouteille 75 cL) |
| 92 | `produits/lait-de-coco.png` | Boissons | Lait de coco — une boîte (Boîte 400 mL) |
| 93 | `produits/eau-de-javel-la-croix-118.png` | Entretien | Eau de Javel — un bidon en plastique avec poignée (Bidon 5 L) |
| 94 | `produits/savon-liquide-mains.png` | Entretien | Savon liquide mains — un flacon (Flacon 500 mL) |
| 95 | `produits/mouchoirs-en-papier.png` | Entretien | Mouchoirs en papier — un lot groupé (Lot de 10 paquets) |
| 96 | `produits/desodorisant.png` | Entretien | Désodorisant — un aérosol (Aérosol 300 mL) |
| 97 | `produits/shampoing.png` | Hygiène & bébé | Shampoing — un flacon (Flacon 400 mL) |
| 98 | `produits/creme-hydratante.png` | Hygiène & bébé | Crème hydratante — un flacon (Flacon 400 mL) |
| 99 | `produits/rasoirs-jetables.png` | Hygiène & bébé | Rasoirs jetables — un lot groupé (Lot de 5) |
| 100 | `produits/cahiers-de-dessin.png` | Fournitures scolaires | Cahiers de dessin — un lot groupé (Lot de 5) |
| 101 | `produits/taille-crayons.png` | Fournitures scolaires | Taille-crayons — un lot groupé (Lot de 10) |

---

## Bloc F — Phase 2 (frais) — à générer plus tard

À ne produire qu'à l'ouverture des produits frais (`PERISHABLES_ENABLED="true"`).
Pour ces visuels, la règle « aucun produit frais » de la charte est levée ; ajoutez au prompt :
« produit frais, aspect naturel et appétissant, sans gouttes artificielles ».

| Fichier | Prompt |
|---|---|
| `categories/frais.png` | Composition : poisson fumé, poulet emballé sous film, plateau d'œufs (style PACKSHOT). |
| `categories/legumes.png` | Composition : tomates, oignons, bananes plantain, piments, igname (style PACKSHOT). |
| `produits/ufs-frais-ferme-d-azaguie.png` | Œufs frais — présentation : Plateau de 30 (style PACKSHOT, produit frais). |
| `produits/poulet-entier-congele-foani.png` | Poulet entier congelé — conditionnement : 1,2 kg (style PACKSHOT, produit frais). |
| `produits/cuisses-de-poulet-sipra.png` | Cuisses de poulet — conditionnement : Carton 2 kg (style PACKSHOT, produit frais). |
| `produits/chinchard-congele.png` | Chinchard congelé — conditionnement : Carton 2 kg (style PACKSHOT, produit frais). |
| `produits/maquereau-congele.png` | Maquereau congelé — conditionnement : 1 kg (style PACKSHOT, produit frais). |
| `produits/poisson-fume-coop-grand-lahou.png` | Poisson fumé — conditionnement : 500 g (style PACKSHOT, produit frais). |
| `produits/viande-de-b-uf.png` | Viande de bœuf — conditionnement : 1 kg (style PACKSHOT, produit frais). |
| `produits/crevettes-sechees.png` | Crevettes séchées — conditionnement : 250 g (style PACKSHOT, produit frais). |
| `produits/yaourt-nature-fan-milk.png` | Yaourt nature — un pack sous film (Pack de 6) (style PACKSHOT, produit frais). |
| `produits/fromage-fondu-la-vache-qui-rit.png` | Fromage fondu — une boîte (Boîte de 24) (style PACKSHOT, produit frais). |
| `produits/tomates-fraiches-coop-bouafle.png` | Tomates fraîches — conditionnement : Panier 2 kg (style PACKSHOT, produit frais). |
| `produits/oignons.png` | Oignons — conditionnement : Filet 2 kg (style PACKSHOT, produit frais). |
| `produits/pommes-de-terre.png` | Pommes de terre — conditionnement : Filet 2 kg (style PACKSHOT, produit frais). |
| `produits/manioc-frais-coop-dabou.png` | Manioc frais — un lot groupé (Lot 3 kg) (style PACKSHOT, produit frais). |
| `produits/banane-plantain-coop-agboville.png` | Banane plantain — présentation : Régime ~12 doigts (style PACKSHOT, produit frais). |
| `produits/igname.png` | Igname — un lot groupé (Lot 3 kg) (style PACKSHOT, produit frais). |
| `produits/aubergines-locales-gnangnan.png` | Aubergines locales (gnangnan) — conditionnement : Tas 1 kg (style PACKSHOT, produit frais). |
| `produits/gombo-frais.png` | Gombo frais — conditionnement : Tas 1 kg (style PACKSHOT, produit frais). |
| `produits/piment-frais.png` | Piment frais — un sac tissé ou en papier kraft (Sachet 250 g) (style PACKSHOT, produit frais). |
| `produits/carottes.png` | Carottes — un sac tissé ou en papier kraft (Sachet 1 kg) (style PACKSHOT, produit frais). |
| `produits/chou.png` | Chou — présentation : Pièce (style PACKSHOT, produit frais). |
| `produits/ail.png` | Ail — un sac tissé ou en papier kraft (Sachet 250 g) (style PACKSHOT, produit frais). |
| `produits/gingembre.png` | Gingembre — un sac tissé ou en papier kraft (Sachet 500 g) (style PACKSHOT, produit frais). |
| `produits/oranges.png` | Oranges — présentation : Filet de 20 (style PACKSHOT, produit frais). |
| `produits/ananas-coop-bonoua.png` | Ananas — présentation : Pièce (style PACKSHOT, produit frais). |
| `produits/avocats.png` | Avocats — un lot groupé (Lot de 6) (style PACKSHOT, produit frais). |

---

## Récapitulatif

| Lot | Nombre | Dossier |
|---|---|---|
| Logo (déclinaisons) | 4 | `communication/` |
| Accueil, étapes, icônes, états, partage | 12 | `hero/`, `onboarding/`, `icones/`, `etats/`, `communication/` |
| Catégories phase 1 | 5 | `categories/` |
| Produits phase 1 | 101 | `produits/` |
| Phase 2 (plus tard) | 28 | `produits/`, `categories/` |

Poids cible après `npm run images:optimize` : produits ≤ 40 ko, illustrations ≤ 60 ko.
