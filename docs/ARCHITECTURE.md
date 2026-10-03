# Architecture

## 1. Analyse de la spécification (phase 1)

La spécification décrit six verticales à terme (BUSINESS, ACHAT, PRO, FOURNISSEUR,
COMMUNAUTÉ, LOGISTICS). Le MVP ne développe pas ces verticales : il construit **un
cœur partagé** autour d'une seule boucle — agréger, acheter, fractionner,
distribuer, mesurer l'économie — sur lequel elles viendront se brancher.

Points structurants relevés dans la spécification et décisions prises :

| Sujet | Risque | Décision |
|---|---|---|
| Prix payé avant que le palier final soit connu | Facturer trop ou trop peu | Le client paie le **prix actuel** (plafond). À la clôture, la différence avec le palier atteint est remboursée. Le prix ne monte jamais, même si des participants annulent. |
| Seuil non atteint | Encaisser sans livrer | Règle configurée par campagne, affichée avant paiement : prolongation, remboursement, prix alternatif (accord explicite + supplément), avoir (seulement si le client l'a choisi). |
| Unités fournisseur ≠ unités consommateur | Erreurs de conversion | Toutes les quantités sont des **entiers en unité de base** (g, mL, pièce). Conversions et arrondis dans le domaine, testés. |
| Panier mêlant plusieurs achats groupés et du stock | Livraisons partielles complexes | Une commande = un paiement. Chaque ligne a son statut ; la commande prend le statut de la ligne la moins avancée et part quand tout est prêt. Une ligne en échec est remboursée seule. |
| « Prix de référence » | Promesse d'économie trompeuse | Toujours daté et sourcé ; au-delà de 30 jours il n'est plus utilisé pour annoncer une économie, et la publication d'une campagne est bloquée. |
| Campagne déficitaire | Perte structurelle | Économie unitaire calculée à chaque palier ; publication bloquée sans acquittement motivé et journalisé. |
| Sélection fournisseur | Choix au moins-disant | Classement multicritère explicable ; décision humaine ; justification obligatoire si l'on s'écarte du classement. |
| Parrainage | Dérive pyramidale | Un seul niveau, récompense après une vraie commande livrée, plafond mensuel. |
| Connexions instables | Abandons, doubles paiements | Pages légères (~106 ko JS), clés d'idempotence sur commande et paiement, webhooks dédupliqués, service worker. |

## 2. Couches

```
src/
├── domain/          Règles métier PURES (aucune dépendance à Next, Prisma, réseau)
├── application/     Services (cas d'usage) : orchestration, transactions, autorisations métier
├── infrastructure/  Prisma, paiements, notifications, auth, limitation de débit, HTTP
├── ui/              Design system + composants de présentation
├── lib/             Accès à la session pour les Server Components
└── app/             Next.js : pages (UI) et routes API REST /api/v1
```

Règle de dépendance : `app → application → domain`, `application → infrastructure`.
Le domaine ne dépend de rien. Les composants React n'implémentent aucun calcul
métier : ils affichent ce que renvoient les services (ex. le prix d'une portion
vient de `PricingService`, le même code qui facture).

### Domaine (`src/domain`)

| Module | Responsabilité |
|---|---|
| `money.ts`, `units.ts` | FCFA entiers, bps, formats français ; unités de base, accords |
| `pricing.ts` | Paliers (validation, palier atteint, suivant), prix de portion, frais de fractionnement, prix plafonné |
| `group-buy.ts` | Progression, éligibilité/capacité, décision d'échéance, règlement succès/échec |
| `aggregation.ts` | Conversion demande ménages → unités fournisseur (pertes, sachets) |
| `fractionation.ts` | Plan de préparation, grand livre de lot, contrôles |
| `unit-economics.ts` | Marge brute/nette par palier, alertes, acquittement requis |
| `checkout.ts` | Récapitulatif : sous-total, économie, fractionnement, livraison, remise, avoir |
| `delivery.ts` | Tarification domicile/point relais, rémunération livreur, créneaux |
| `order-status.ts`, `payment.ts` | Machines d'états, dérivation du statut, frise, idempotence des webhooks |
| `savings.ts`, `reference-price.ts` | Économies (jamais négatives), fraîcheur des références |
| `rfq.ts` | Classement multicritère, contrôle de l'attribution |
| `referral.ts`, `community.ts`, `permissions.ts`, `phone.ts` | Parrainage, niveaux de communauté, RBAC, numéros ivoiriens |

### Services (`src/application`)

`GroupBuyService` (group-buy.service), `PricingService`, `OrderService`,
`PaymentService`, `InventoryService`, `SupplierService` + `procurement.service`
(RFQ/BC), `DeliveryService`, `CommunityService`, `NotificationService`,
`SavingsService`, plus `auth`, `cart`, `catalog`, `credit`, `referral`,
`privacy`, `support`, `admin`, `analytics`, `audit`, `jobs`.

Chaque fonction accepte un client Prisma **ou une transaction** (`Db`), ce qui
permet de composer plusieurs opérations atomiquement (ex. paiement confirmé →
lignes confirmées → compteurs d'achat groupé → fiche de livraison →
notification, dans une seule transaction).

### Concurrence

- Achat groupé : `SELECT … FOR UPDATE` sur la ligne `GroupBuy` lors d'une commande,
  d'un paiement et de la clôture → la capacité fournisseur ne peut pas être dépassée.
- Stock : verrou sur les lignes `Inventory` concernées.
- Paiement : verrou sur la ligne `Payment` à la réception d'un webhook +
  unicité `(provider, providerEventId)`.
- Remboursements : enregistrés dans la transaction métier (statut `PENDING`),
  exécutés auprès du prestataire **après** la transaction (`processPendingRefunds`),
  donc rejouables sans double remboursement.

## 3. Parcours utilisateurs (phase 2)

**Ménage** : bienvenue → inscription → accueil (achats groupés, économies) →
achat groupé (progression, paliers, règles) → portion → panier → checkout
(point relais ou domicile → créneau → récapitulatif → paiement) → confirmation →
suivi (frise) → code de retrait → économies cumulées → parrainage.

**Admin** : tableau de bord → crée un achat groupé (brouillon) → évaluation de
l'économie unitaire → publication → suit la progression → clôture → demande
consolidée → RFQ → comparaison → attribution → réception → fractionnement →
logistique (tournée point relais / attribution livreur) → indicateurs.

**Fournisseur** : RFQ ouvertes → offre → bon de commande → confirmation →
expédition → paiement reçu ; tarifs dégressifs et capacité.

**Point relais** : colis en route → « Reçu » (le client est notifié avec son
code) → remise contre code/QR → rémunération.

**Livreur** : mission → accepter/refuser → récupérer → itinéraire → code OTP →
livré ; incident possible à chaque étape.

## 4. API et clients futurs

Toutes les mutations passent par l'API REST `/api/v1` (voir [API.md](API.md)),
y compris pour l'interface web. Une application Android/iOS ou React Native
réutilise donc la même API (authentification par `Authorization: Bearer`) et la
même logique métier, sans réécriture. Les schémas zod (`application/schemas.ts`)
peuvent être partagés avec un client TypeScript.

## 5. Évolution vers les verticales

| Verticale | Point d'extension existant |
|---|---|
| Sesam BUSINESS | Modèle `Merchant`, rôle `MERCHANT` (achat déjà possible, unités entières) |
| Sesam PRO | Mêmes achats groupés, portions = unités fournisseur ; paliers par volume |
| Sesam FOURNISSEUR | Portail fournisseur, `SupplierProduct` + `PriceTier`, KYB |
| Sesam COMMUNAUTÉ | `Community`, niveaux d'avantages, achats réservés |
| Sesam LOGISTICS | `Delivery`, `Driver`, `PickupPoint`, `DeliveryZone`, `Warehouse` multi-entrepôts |

## 6. Choix techniques

- **Monolithe modulaire Next.js** : un seul déploiement, coût d'exploitation minimal ; la séparation en couches permet d'extraire un service plus tard si nécessaire.
- **PostgreSQL + Prisma** : transactions, verrous de ligne, contraintes d'unicité utilisées comme garde-fous métier.
- **Pas de Redis obligatoire** : la limitation de débit est en mémoire derrière une interface (`RateLimiter`) ; à brancher sur Redis en multi-instance.
- **Tâches planifiées** via un endpoint protégé (`/api/v1/jobs/run`) appelé par n'importe quel cron : pas d'infrastructure de files à opérer au démarrage.
- **Police système, images remplacées par des pictogrammes** : zéro octet de police/image à charger sur réseau mobile.
