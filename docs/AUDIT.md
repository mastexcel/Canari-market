# Audit final (phases 13–14)

État au moment de la livraison du MVP. « Corrigé » = défaut trouvé pendant
l'audit et corrigé dans le code (avec test quand c'est pertinent).

## Vérifications exécutées

| Contrôle | Résultat |
|---|---|
| `npm run lint` | 0 erreur, 0 avertissement |
| `npm run typecheck` (strict) | 0 erreur |
| `npm test` (unitaires + intégration PostgreSQL + API) | 92 tests verts |
| Couverture domaine (calculs financiers) | pricing, group-buy, aggregation, fractionation, payment, rfq, referral, community : 99–100 % ; checkout 98 % ; unit-economics 93 % |
| `npm run test:e2e` (Playwright, Chromium mobile) | 2 scénarios verts (parcours critique complet, espaces protégés) |
| `npm run build` | OK — ~106 ko de JS au premier chargement par page ménage |
| Seed | 1 171 commandes passées par les services ; compteurs, stocks, remboursements cohérents |

## Logique métier

| Constat | Statut |
|---|---|
| Classement RFQ : le « moins cher » était calculé en incluant les fournisseurs non vérifiés | Corrigé (références prises parmi les offres éligibles ; test) |
| Acceptation d'un prix alternatif comptait deux fois le volume engagé | Corrigé |
| Remboursement d'un supplément reçu hors délai ciblait le premier paiement de la commande | Corrigé (cible le paiement du supplément) |
| `placeOrder` n'horodatait pas la commande à la date métier fournie (historique, tests) | Corrigé |
| Poids logistique faux pour les achats groupés à la pièce ou au litre (frais de livraison sous-estimés) | Corrigé (`portionWeightGrams`, test) |
| RFQ possible avant la clôture alors que les quantités ne sont pas définitives | Corrigé (RFQ après clôture uniquement) |
| Pluriels d'unités (« sac 50 kgs ») | Corrigé (`unitNoun`, test) |
| Prix ne pouvant jamais monter, différence remboursée, avoir seulement avec accord | Vérifié par tests d'intégration |
| Capacité fournisseur jamais dépassée en concurrence | Verrous de ligne + test |

## Sécurité

| Constat | Statut |
|---|---|
| Déduplication des webhooks reposant sur une erreur d'unicité dans une transaction | Corrigé (vérification préalable sous verrou ; l'unicité reste en filet de sécurité) |
| Cookie `Secure` lié à `NODE_ENV` (inutilisable en démo HTTP, mais à garantir en HTTPS) | Corrigé (lié au schéma de `APP_URL`) |
| Cache client Next conservant une redirection de l'état « déconnecté » après connexion | Corrigé (navigation complète après connexion/inscription/déconnexion) |
| Prestataire de paiement simulé utilisable en production | Bloqué (sauf drapeau explicite de démo) — vérifié en E2E |
| Accès sans session | Seules les routes publiques prévues ; webhook (signature) et cron (secret) protégés |
| RBAC granulaire | Testé : ménage/livreur refusés sur les espaces pro ; admin « opérations » ne peut ni rembourser ni publier ni changer de permissions |
| Force brute sur les codes de retrait | 5 essais / colis / 15 min |

## UX et accessibilité

- Parcours vérifiés à 390 px de large (captures) : accueil, achat groupé, checkout, suivi, back-office.
- Le groupe → le volume → le prix → l'économie : visibles sur la carte et la page d'achat groupé (progression, paliers, « plus que N », prochain prix, économie datée).
- Règles d'échec et garantie de prix affichées **avant** paiement, case de prise de connaissance obligatoire.
- Navigation basse à 5 entrées + bouton Communautés en en-tête ; lien d'évitement ; focus visible ; `aria-current`, barres de progression `role="progressbar"`, modales `<dialog>` natives ; graphiques avec vue tableau ; contraste : le jaune canari n'est jamais utilisé pour du texte sur fond blanc.
- États vides, squelettes de chargement, erreurs explicites en français ; page hors ligne.

## Performance et faible connexion

- Pages rendues côté serveur ; JavaScript client limité aux interactions (≈ 106 ko partagés).
- Aucune police ni image à télécharger (police système, pictogrammes).
- Service worker : ressources statiques en cache, pages publiques en « réseau d'abord » avec repli hors ligne ; API jamais en cache.
- Requêtes idempotentes : un double tap ou une reprise après coupure ne crée ni double commande ni double paiement.
- Lecture de session mémorisée par requête (layout + page).

## Limites connues (non bloquantes pour le MVP)

- Prestataire de paiement, SMS/WhatsApp/e-mail et push : architecture et adaptateurs prêts, **fournisseurs réels à brancher** (journalisation à la place).
- Limitation de débit en mémoire (une instance) : passer à Redis en multi-instance.
- Téléversement des documents KYB : modèle et règles définis (voir SECURITY.md), écran d'upload à réaliser.
- Pas de vérification OTP du téléphone à l'inscription (dépend de la passerelle SMS).
- Back-office : la création de catégories/produits se fait encore par seed/base (le catalogue de démo couvre 100 produits).
- Réponses aux tickets support depuis le back-office : modèle prêt (`SupportMessage`), écran à réaliser.
