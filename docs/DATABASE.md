# Base de données

PostgreSQL, schéma Prisma : `prisma/schema.prisma` (source de vérité, commentée),
migrations versionnées dans `prisma/migrations`.

## Conventions

| Convention | Raison |
|---|---|
| Montants `Int` en FCFA | Le XOF n'a pas de sous-unité ; aucun flottant pour l'argent |
| Quantités `Int` suffixées `Base` (g, mL, pièce) | Conversions exactes entre unités fournisseur et portions |
| Taux en bps (`lossRateBps`, `paymentFeeBps`) | Entiers, pas d'arrondi flottant |
| Identifiants `cuid`, numéros lisibles séparés | `CAN-261003-7KQ2M`, `RFQ-2026-…`, `BC-2026-…` |
| Mouvements de stock immuables | Le grand livre de lot se recalcule à partir d'eux |
| Instantanés sur les lignes de commande | Prix payé, référence et date figés au moment de l'achat |

## Domaines et modèles

**Identité & conformité** — `User` (rôle, permissions admin, verrouillage),
`Session` (hash du jeton), `ConsentRecord` (journal versionné), `Household`,
`Merchant`, `Address`, `AuditLog`, `AnalyticsEvent` (sans données personnelles).

**Catalogue** — `Category` (arborescence), `Product` (unité de base),
`ProductVariant` (unité vendue, poids, prix CANARI), `ReferencePrice` (prix daté,
source, méthode), `FamilyBasket` / `FamilyBasketItem`.

**Fournisseurs** — `Supplier` (scores qualité/fiabilité/ponctualité, statut KYB),
`SupplierVerification` (documents, clé de stockage privée), `SupplierProduct`
(unité fournisseur, capacité, délai), `PriceTier`.

**Achats groupés** — `GroupBuy` (unité fournisseur, objectif, capacité, compteurs
`committedBase`/`heldBase`, référence datée, calendrier, règle d'échec, coûts
d'économie unitaire, acquittement de déficit), `GroupBuyTier`, `GroupBuyPortion`,
`GroupBuyParticipant` (quantité, statut, accord d'avoir).

**Communautés** — `Community` (type, point relais, jour de livraison, code
d'invitation), `CommunityMember` (rôle).

**Commandes & paiements** — `Cart`/`CartItem`, `Order` (totaux, mode, créneau,
code de retrait, clé d'idempotence), `OrderItem` (statut par ligne, prix payé,
prix final, référence figée), `OrderStatusEvent` (frise), `Payment` (objet :
commande ou supplément), `PaymentTransaction` (unicité prestataire + événement),
`Refund`, `CreditLedgerEntry` (avoirs), `IdempotencyKey`, `Promotion`, `Referral`.

**Logistique & stock** — `Warehouse`, `Inventory` (stock et réservé par produit),
`InventoryMovement` (réception, fractionnement, perte, remise, écart, réservation),
`DeliveryZone` (tarif par commune), `PickupPoint` (gérant, rémunération),
`Driver`, `Delivery` (mission, OTP via la commande, tentatives, incidents).

**Approvisionnement** — `RFQ` (quantité consolidée, qualité, destination,
justification d'attribution), `RFQResponse` (unique par fournisseur et RFQ),
`PurchaseOrder`, `PurchaseOrderItem` (reçu, avarie).

**Relation client** — `Notification` (canal, statut d'envoi), `Review`,
`SupportTicket`, `SupportMessage`.

## Contraintes utilisées comme garde-fous

- `Order.idempotencyKey`, `Payment.idempotencyKey` uniques → pas de double commande / double paiement.
- `PaymentTransaction (provider, providerEventId)` unique → webhooks dédupliqués.
- `GroupBuyParticipant.orderItemId` unique ; `GroupBuyTier (groupBuyId, minUnits)` et `GroupBuyPortion (groupBuyId, quantityBase)` uniques.
- `RFQResponse (rfqId, supplierId)` unique ; `CommunityMember (communityId, userId)` unique ; `Referral.refereeId` unique (un seul parrain).
- `Inventory (warehouseId, productId)` unique.

## Index principaux

`GroupBuy(status, closesAt)` pour les échéances ; `Order(userId, createdAt)`,
`Order(status)`, `Order(createdAt)` pour les listes et indicateurs ;
`OrderItem(groupBuyId, status)` pour l'avancement des lots ;
`InventoryMovement(groupBuyId, type)` pour le grand livre ;
`Notification(status, channel)` pour la file d'envoi ;
`AnalyticsEvent(name, createdAt)` pour le funnel ; `AuditLog(entityType, entityId)`.

## Rétention

| Donnée | Durée |
|---|---|
| Compte, adresses, foyer | Tant que le compte est actif ; effacés à la suppression |
| Commandes, paiements, remboursements | 10 ans (obligations comptables), pseudonymisés après suppression du compte |
| Sessions | 30 jours (purge quotidienne) |
| Clés d'idempotence | 7 jours |
| Journal d'audit, consentements | Durée légale de preuve |
