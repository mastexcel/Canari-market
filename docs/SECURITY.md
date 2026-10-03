# Sécurité et confidentialité

## Authentification et sessions

- Connexion par téléphone (normalisé E.164 ivoirien) + mot de passe (8+ caractères, lettre + chiffre), haché **bcrypt** (coût 11).
- Message d'erreur identique pour numéro inconnu / mauvais mot de passe, et temps de réponse constant (hachage factice) → pas d'énumération de comptes.
- Verrouillage 15 minutes après 5 échecs ; limitation de débit par IP sur inscription et connexion.
- Sessions opaques : jeton aléatoire 256 bits, **seul son SHA-256 est stocké** ; expiration 30 jours ; fermeture de toutes les sessions à la suspension ou au changement de mot de passe.
- Cookie `httpOnly`, `SameSite=Lax`, `Secure` dès que l'application est servie en HTTPS.
- Après connexion/déconnexion, navigation complète pour repartir d'un cache client vierge.

## Autorisations (RBAC)

- Rôles : ménage, commerçant, fournisseur, point relais, livreur, admin.
- Admin : **permissions granulaires** (utilisateurs, fournisseurs, prix, achats groupés, commandes, paiements, remboursements, logistique, analytics, audit…), `SUPER_ADMIN` seul peut attribuer des permissions ; on ne peut modifier ni son propre statut ni ses propres permissions.
- Vérifications **côté serveur** à chaque route (wrapper `route()`) et dans les layouts ; les menus ne font que refléter les droits.
- Isolation des données : un fournisseur ne voit que ses RFQ/BC et jamais les offres concurrentes ; un livreur que ses missions ; un point relais que ses colis ; un ménage que ses commandes.

## Protection des API

- Validation **zod** de toutes les entrées ; montants et quantités entiers bornés.
- **CSRF** : contrôle de l'en-tête `Origin` sur toute mutation authentifiée par cookie.
- **Limitation de débit** (fenêtre glissante) sur les routes sensibles ; codes OTP de retrait/livraison : 5 essais par colis / 15 min.
- Erreurs internes jamais détaillées au client ; journalisation structurée côté serveur.
- En-têtes : CSP stricte (`default-src 'self'`, pas de framing), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en production ; `Cache-Control: no-store` sur l'API.
- Redirections après connexion limitées aux chemins internes (anti « open redirect »).

## Paiements

- **Aucune donnée de carte ni code Mobile Money** ne transite ni n'est stockée : la saisie se fait chez le prestataire (redirection). Le numéro du payeur est stocké **masqué**.
- Abstraction `PaymentProvider` ; le prestataire simulé est **refusé en production** sauf drapeau explicite `ALLOW_MOCK_PAYMENTS` (démo locale uniquement).
- Webhooks : signature **HMAC-SHA256** sur `horodatage.corps`, comparaison à temps constant, fenêtre anti-rejeu de 5 minutes, corps limité à 64 ko, déduplication par identifiant d'événement, vérification du montant, transitions d'état contrôlées.
- **Idempotence** : clés côté client pour commande et paiement ; un seul paiement actif par commande ; double paiement remboursé automatiquement.
- Remboursements plafonnés au remboursable ; manuels soumis à la permission dédiée et journalisés.

## Intégrité métier

- Verrous de ligne PostgreSQL sur achats groupés, stocks, paiements et commandes lors des opérations concurrentes.
- **Journal d'audit** : création/publication/clôture d'achats groupés (avec avertissements et justification de déficit), **toute modification de prix** (paliers CANARI et tarifs fournisseurs, avant/après), attribution de RFQ (rang, justification), réceptions, fractionnements, écarts, remboursements manuels, permissions, statuts, vérifications KYB, exports et suppressions de données.

## Téléversements (KYB)

Les documents fournisseurs sont référencés par une **clé de stockage privée**
(S3 compatible), jamais par une URL publique. Toute route d'upload devra :
vérifier le type MIME réel (PDF/JPEG/PNG), limiter la taille (5 Mo), renommer le
fichier (clé aléatoire), stocker hors de la racine web et servir par URL signée
à durée courte, réservée aux admins `SUPPLIERS_MANAGE`.

## Secrets

Aucun secret dans le dépôt (`.env*` ignorés sauf `.env.example`). Variables
validées au démarrage (`infrastructure/env.ts`) : `SESSION_SECRET`,
`PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET` de longueur minimale.

## Confidentialité (privacy-by-design)

- Collecte minimale : prénom, téléphone, commune/quartier, taille approximative du foyer, adresses de livraison.
- **Consentements** versionnés et horodatés (CGU, confidentialité, SMS, WhatsApp, analytics), modifiables à tout moment ; historique consultable par l'utilisateur.
- **Export** complet des données (JSON) et **suppression** du compte en libre-service (pseudonymisation : identité effacée, pièces comptables conservées détachées de la personne).
- Événements analytics **sans données personnelles** ; transactions individuelles **jamais vendues** ; toute analyse externe est agrégée et anonymisée.
- Notifications marketing uniquement avec consentement ; notifications transactionnelles (paiement, retrait) envoyées dans le cadre du contrat.

## Points à traiter avant production

- Brancher la limitation de débit sur Redis en multi-instance.
- Vérification du numéro de téléphone par OTP SMS à l'inscription (passerelle SMS).
- Prestataire de paiement réel (agrément BCEAO) et rapprochement quotidien.
- Analyse de dépendances (npm audit) et revue de sécurité externe.
