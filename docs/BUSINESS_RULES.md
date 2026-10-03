# Règles métier

Toutes ces règles sont implémentées dans `src/domain/` et couvertes par des tests
(`tests/unit`, `tests/integration`). Montants en **FCFA entiers** ; quantités en
**unité de base entière** (g, mL, pièce) ; taux en **points de base** (100 bps = 1 %).

## 1. Achat groupé

- Un achat groupé porte sur un produit vendu par **unité fournisseur** (ex. sac de 50 kg = 50 000 g).
- **Paliers** : à partir de `minUnits` unités engagées, prix client `unitPrice` par unité fournisseur. Seuils strictement croissants, prix strictement décroissants (validé).
- **Seuil minimal** = premier palier. **Objectif** affiché = `targetUnits` (prix « CANARI » mis en avant). **Capacité** = `maxUnits` (offre fournisseur).
- **Progression** = quantités **payées** / unité fournisseur. Les réservations en attente de paiement (`heldBase`) comptent pour la capacité mais pas pour la progression.
- « Plus que N » est arrondi **au supérieur** : on n'affiche jamais 0 tant que le seuil n'est pas atteint.
- « Encore N commandes » = reste ÷ quantité moyenne réelle par participant (à défaut, portion moyenne attendue).

### Prix payé, prix final

- Le client paie le prix du **palier actuellement atteint**, ou du premier palier s'il n'est pas encore atteint : c'est un **plafond**.
- À la clôture réussie, chaque portion est repricée au palier final ; si ce prix est inférieur, **la différence est remboursée automatiquement** (raison `TIER_PRICE_DIFFERENCE`).
- Le prix final d'un participant ne dépasse **jamais** ce qu'il a payé (même si des annulations font redescendre le volume).

### Prix d'une portion

```
prix portion = arrondi(prix unité × portion / unité fournisseur)
frais de fractionnement = fractionationFeePerPortion si portion < unité fournisseur, sinon 0
```

Les frais de fractionnement sont affichés séparément au checkout.

### Échéance (tâche planifiée ou clôture manuelle)

| Situation | Décision |
|---|---|
| Seuil atteint | Clôture réussie, prix final, remboursements de différence |
| Seuil non atteint, règle `EXTEND`, prolongations restantes | Prolongation de `extensionDays` (livraison prévue décalée d'autant) |
| Seuil non atteint, `EXTEND` épuisé | Remboursement intégral |
| `REFUND` | Remboursement intégral (produit + fractionnement ; frais de livraison remboursés si plus rien à livrer) |
| `CREDIT_WITH_CONSENT` | Avoir **uniquement** pour les participants ayant coché ce choix avant de payer ; les autres sont remboursés |
| `ALTERNATIVE_PRICE` | Le participant choisit : accepter (paiement d'un supplément) ou être remboursé. Sans réponse sous 72 h : remboursement. Jamais de débit sans accord. |

Les réservations non payées sont abandonnées à la clôture. Une commande payée
après la clôture (paiement tardif) voit sa ligne annulée et remboursée.

La règle est affichée sur la page de l'achat **et** au récapitulatif ; le client
doit cocher « J'ai pris connaissance de ces règles » avant de payer.

## 2. Agrégation et fractionnement

- Demande consolidée = somme des portions confirmées, groupées par taille.
- Les **portions de la taille de l'unité fournisseur** sont remises telles quelles (pas d'ouverture, pas de perte).
- Les autres sont reconditionnées : pertes prévues = `lossRateBps` × volume reconditionné.
- Unités à commander = ⌈(volume total + pertes prévues) ÷ unité fournisseur⌉.
- **Grand livre de lot** (mouvements immuables) :
  - acheté = Σ réceptions ; préparé = Σ fractionnements ; pertes = Σ pertes ; livré = Σ remises ; écarts = Σ ajustements (signés)
  - vrac restant = acheté − préparé − pertes + écarts
  - reste à préparer = max(0, réservé − préparé) ; reste à livrer = réservé − livré + retours
  - excédent = acheté − pertes + écarts − réservé (négatif = **manque**, signalé)
- On ne peut pas préparer plus que le vrac restant, ni remettre plus que le préparé.
- Quand tout le réservé est préparé, les lignes passent « Prête ».

## 3. Économie unitaire et publication

Pour chaque palier (au seuil du palier = pire cas pour ce prix) :

```
CA            = unités × prix client + frais de fractionnement facturés
Coût achat    = unités × prix fournisseur ; transport amont ; coût des pertes
Marge brute   = CA − coût achat − transport amont − pertes
Marge nette   = marge brute − stockage − fractionnement − emballage − frais de paiement − livraison − promotions
```

- Marge brute ou nette négative à un palier → **bloquant** : publication impossible sans case d'acquittement **et** justification (≥ 15 caractères), journalisées.
- Marge nette < 3 % → avertissement. Prix client ≥ référence → avertissement « pas d'économie ».
- Prix de référence de plus de 30 jours → publication **impossible** (nouveau relevé requis).

## 4. Prix de référence et économies

- Chaque prix de référence a une **date**, une **source** et une **méthode** affichées.
- Au-delà de **30 jours**, il n'est plus utilisé pour annoncer une économie (« Relevé ancien », économie non affichée).
- Pour une portion, la référence est le **prorata** de la référence par unité fournisseur (estimation prudente : le détail est en général plus cher au kg).
- **Économie d'une ligne** = (référence − prix final − frais de fractionnement) × quantité, plancher 0. Frais de livraison exclus (ils existent aussi pour un achat au détail).
- Seules les lignes payées, non annulées ni remboursées, comptent.
- La référence est figée sur la ligne au moment de la commande.

## 5. Commande

- Une commande = un paiement, plusieurs lignes possibles (achats groupés + stock).
- Statut d'une ligne : achat groupé `GROUP_PENDING → GROUP_CONFIRMED → SUPPLIER_ORDERED → SUPPLIER_CONFIRMED → RECEIVED_WAREHOUSE → PACKING → READY` ; stock : `RECEIVED_WAREHOUSE → READY`.
- Statut de la commande = celui de la ligne active la moins avancée, puis piloté par la livraison (`OUT_FOR_DELIVERY` / `READY_FOR_PICKUP` → `DELIVERED`).
- Annulation par le client possible tant que tous ses achats groupés sont ouverts (remboursement intégral si payée).
- Commande non payée sous 1 h : annulée, réservations libérées.
- Totaux : `total = sous-total + fractionnement + livraison − remise − avoir`.

## 6. Paiements

- Statuts : `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`.
- Un seul paiement en cours par commande ; clé d'idempotence côté client.
- Webhook : signature HMAC + horodatage (± 5 min), dédupliqué par identifiant d'événement, montant vérifié, transitions contrôlées (un « échec » reçu après « payé » est ignoré).
- Double paiement d'une même commande → remboursement intégral automatique du second.
- Remboursements répartis sur les paiements réglés, jamais au-delà du remboursable.

## 7. Livraison

- **Point relais** : frais du point (souvent 0), remise contre code à 6 chiffres ou QR (`CANARI:<n°>:<code>`), 5 essais max / 15 min par colis.
- **Domicile** : `frais = base commune + (kg au-delà de 10) × 50 + distance × tarif/km + 200/article encombrant (≥ 25 kg) + supplément créneau programmé (500)`.
- Créneaux 8 h–12 h et 14 h–18 h, pas de dimanche, à partir de la date où tout est prêt.
- Incident : la livraison repasse « à attribuer », la commande repasse « Prête ».

## 8. Communautés

Niveau calculé sur les commandes payées du mois par les membres :

| Niveau | Commandes/mois | Avantage |
|---|---|---|
| Démarrage | 0 | — |
| Bronze | 10 | Retrait gratuit au point relais de la communauté |
| Argent | 30 | + −10 % sur la livraison à domicile |
| Or | 60 | + −25 % sur la livraison à domicile |

## 9. Parrainage (non pyramidal)

- Un seul niveau ; pas d'auto-parrainage.
- Récompense (500 F d'avoir pour chacun) **uniquement** quand la **première commande** du filleul est **livrée**, d'au moins 5 000 F nets de remboursements.
- Plafond : 10 récompenses par parrain et par mois. Financement par la marge d'activités réelles.

## 10. Fournisseurs et RFQ

- Seuls les fournisseurs **vérifiés (KYB)** reçoivent les RFQ et peuvent être retenus.
- Classement : prix 40 %, qualité 20 %, fiabilité 15 % (historique + ponctualité), délai 15 %, capacité 10 %. Références de prix/délai prises parmi les offres éligibles.
- Alertes : capacité partielle, délai trop long, moins cher mais peu fiable, qualité insuffisante, non vérifié.
- L'attribution est **humaine** ; s'écarter de la meilleure offre exige une justification journalisée.
- Ponctualité fournisseur mise à jour à chaque réception.
