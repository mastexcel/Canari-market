# API REST v1

Base : `/api/v1`. JSON en entrée et en sortie. Utilisée par l'interface web et
destinée aux futures applications mobiles.

## Authentification

- **Web** : cookie `canari_session` (httpOnly, SameSite=Lax, Secure en HTTPS), posé par `/auth/login` ou `/auth/signup`.
- **Mobile** : le même jeton, renvoyé dans le corps (`token`), à envoyer en `Authorization: Bearer <jeton>`.
- Mutations par cookie : l'en-tête `Origin` doit correspondre à l'hôte (protection CSRF). Les requêtes Bearer en sont dispensées.

## Erreurs

```json
{ "error": { "code": "CAPACITY_EXCEEDED", "message": "La capacité du fournisseur est atteinte…", "details": {} } }
```

| Code | HTTP | Sens |
|---|---|---|
| `VALIDATION` | 400 | Données invalides (`issues` liste les champs) |
| `UNAUTHENTICATED` | 401 | Non connecté, identifiants ou webhook invalides |
| `PAYMENT_ERROR` | 402 | Erreur de paiement |
| `FORBIDDEN` | 403 | Rôle/permission insuffisant, origine refusée |
| `NOT_FOUND` | 404 | Ressource introuvable |
| `CONFLICT`, `INVALID_STATE`, `CAPACITY_EXCEEDED` | 409 | Conflit métier |
| `RATE_LIMITED` | 429 | Trop de requêtes / trop d'essais |
| `INTERNAL` | 500 | Erreur inattendue (détail jamais exposé) |

## Idempotence

`POST /orders` et `POST /payments` acceptent l'en-tête `Idempotency-Key` : un
renvoi avec la même clé (réseau coupé, double tap) renvoie la même commande / le
même paiement, sans doublon.

## Routes publiques et ménage

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/signup` | Inscription (5/15 min/IP) |
| POST | `/auth/login` | Connexion (10/15 min/IP ; compte verrouillé 15 min après 5 échecs) |
| POST | `/auth/logout` | Déconnexion |
| GET | `/auth/me` | Utilisateur courant |
| GET | `/group-buys?categorie=` | Achats groupés ouverts + progression |
| GET | `/group-buys/:slug` | Détail, portions tarifées, règles d'échec |
| POST | `/group-buys/alternative/:itemId` | Refuser un prix alternatif (→ remboursement) |
| GET | `/products?q=&categorie=` | Recherche catalogue + comparateur |
| GET | `/cart` | Panier re-tarifé |
| POST | `/cart/items` | `{kind:"GROUP_BUY", portionId, quantity}` ou `{kind:"STOCK", variantId, quantity}` |
| PATCH / DELETE | `/cart/items/:id` | Modifier / retirer une ligne |
| POST | `/cart/baskets` | Ajouter un panier famille `{slug}` |
| POST | `/checkout/quote` | Récapitulatif chiffré (mêmes règles que la commande) |
| POST | `/orders` | Passer commande (idempotent) |
| GET | `/orders`, `/orders/:id` | Liste, détail + frise |
| POST | `/orders/:id/cancel` | Annuler (remboursement si payée) |
| POST | `/payments` | `{orderId, method, operator?, payerPhone?, purpose: ORDER|SUPPLEMENT, orderItemId?}` → `{paymentId, redirectUrl}` |
| POST | `/payments/:id/simulate` | Prestataire simulé uniquement : `{outcome: PAID|FAILED}` |
| POST | `/webhooks/payments/:provider` | Webhook prestataire (signature HMAC `x-canari-signature: t=…,v1=…`) |
| GET / POST | `/communities` | Lister / créer |
| POST | `/communities/:id/join`, `/leave` | Adhérer (code si privée) / quitter |
| GET / POST | `/notifications` | Lister / tout marquer lu |
| POST | `/referrals/share` | Tracer un partage (analytics) |
| POST | `/support`, `/reviews` | Ticket, avis (après livraison) |
| GET | `/account/export` | Export JSON des données personnelles |
| POST | `/account/consents` | Modifier un consentement |
| POST | `/account/delete` | Supprimer le compte `{password, confirm:"SUPPRIMER"}` |
| GET | `/health` | Santé (base de données) |

## Back-office : commandes

Chaque espace expose une route `POST …/commands` recevant `{ "type": "...", ... }`.
Le type détermine la permission requise et le service appelé.

### `POST /admin/commands` (rôle ADMIN)

| type | Permission(s) | Champs |
|---|---|---|
| `groupbuy.create` | GROUPBUYS_MANAGE + PRICING_MANAGE | `data` (schéma complet) |
| `groupbuy.publish` | GROUPBUYS_MANAGE + PRICING_MANAGE | `id, acknowledgeDeficit?, reason?` |
| `groupbuy.close` | GROUPBUYS_MANAGE | `id, force?: success|cancel` |
| `groupbuy.rfq` | GROUPBUYS_MANAGE + SUPPLIERS_MANAGE | `id, quality, packaging, destination, neededBy, closesAt` |
| `rfq.award` | SUPPLIERS_MANAGE + PRICING_MANAGE | `rfqId, responseId, justification?` |
| `po.receive` | LOGISTICS_MANAGE | `poId, receivedUnits, damagedBase` |
| `po.paid` | PAYMENTS_MANAGE | `poId` |
| `lot.fractionate` | LOGISTICS_MANAGE | `groupBuyId, portionBase, portionCount, lossBase` |
| `lot.adjust` | LOGISTICS_MANAGE | `groupBuyId, quantityBase (signé), note` |
| `order.prepare` | LOGISTICS_MANAGE | `orderId` |
| `order.refund` | REFUNDS_MANAGE | `orderId, amount, note` |
| `logistics.dispatchPickup` | LOGISTICS_MANAGE | `orderIds[]` |
| `logistics.assignDriver` | LOGISTICS_MANAGE | `orderId, driverId` |
| `user.status` | USERS_MANAGE | `userId, status` |
| `user.permissions` | SUPER_ADMIN | `userId, permissions[]` |
| `supplier.verify` | SUPPLIERS_MANAGE | `supplierId, status, notes?` |
| `jobs.run` | SUPER_ADMIN | — |

`SUPER_ADMIN` implique toutes les permissions.

### `POST /supplier/commands` (rôle SUPPLIER)
`rfq.respond {rfqId, data}` · `po.confirm {poId}` · `po.ship {poId}` · `product.update {supplierProductId, capacityUnitsPerWeek, leadTimeDays, tiers[]}`

### `POST /driver/commands` (rôle DRIVER)
`accept` · `reject` · `pickup` · `deliver {code}` (5 essais/15 min) · `incident {reason}` — tous avec `deliveryId`.

### `POST /pickup/commands` (rôle PICKUP_POINT)
`receive {orderNumber}` · `handover {orderNumber, code}` (5 essais/15 min) · `incident {deliveryId, reason}`

## Tâches planifiées

`POST /jobs/run` avec `Authorization: Bearer <CRON_SECRET>` : expire les paiements
et commandes non réglés, traite les échéances d'achats groupés, les décisions de
prix alternatif, les remboursements en attente, la file de notifications, purge
sessions et clés d'idempotence. À appeler toutes les 5 à 15 minutes.
