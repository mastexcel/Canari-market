# Déploiement

## Cible recommandée (coût minimal)

- **1 conteneur Node.js 22** (Next.js en mode `standalone` ou `next start`) derrière un reverse proxy HTTPS.
- **PostgreSQL managé** (sauvegardes quotidiennes + PITR).
- **Cron** externe appelant `/api/v1/jobs/run` toutes les 5 à 15 minutes.
- Optionnel : Redis (limitation de débit multi-instance), stockage S3 compatible (documents KYB).

Hébergement proche des utilisateurs (Afrique de l'Ouest ou Europe de l'Ouest) pour la latence mobile.

## Variables d'environnement

Voir `.env.example`. Obligatoires en production :

| Variable | Remarque |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `APP_URL` | URL publique **https://** (active les cookies `Secure`) |
| `SESSION_SECRET` | ≥ 24 caractères aléatoires (`openssl rand -base64 48`) |
| `PAYMENT_PROVIDER` | Prestataire réel ; `mock` est refusé en production |
| `PAYMENT_WEBHOOK_SECRET` | Fourni par le prestataire |
| `CRON_SECRET` | Jeton du cron |

Ne **jamais** définir `ALLOW_MOCK_PAYMENTS` ni `ALLOW_PROD_SEED` en production.

## Étapes

```bash
npm ci
npx prisma migrate deploy        # migrations versionnées, sans perte
npm run build
npm start                        # PORT=3000 par défaut
```

Cron (exemple) :

```
*/10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://canari.ci/api/v1/jobs/run
```

Santé : `GET /api/v1/health` (200 si la base répond, 503 sinon).

## Intégration continue

`.github/workflows/ci.yml` : installation, lint, typecheck, migrations sur une
base PostgreSQL de service, tests unitaires + intégration avec couverture, build.

## Exploitation

- Journaux JSON sur la sortie standard (`level`, `msg`, contexte) — compatibles avec tout collecteur.
- Surveiller : remboursements en attente/échec (tableau de bord admin), webhooks rejetés (`webhook.rejected`), `api.unhandled`, échéances d'achats groupés.
- Sauvegardes : tester la restauration mensuellement.
- Mises à jour du service worker : incrémenter `VERSION` dans `public/sw.js` lors d'un changement de stratégie de cache.

## Brancher un prestataire de paiement réel

1. Implémenter `PaymentProvider` (`src/infrastructure/payments/provider.ts`) : `createCharge`, `parseWebhook` (vérification de signature du prestataire), `refund`.
2. L'enregistrer dans `registry.ts` et définir `PAYMENT_PROVIDER`.
3. Déclarer l'URL de webhook `https://<domaine>/api/v1/webhooks/payments/<nom>` chez le prestataire.
4. Tester en sandbox : succès, échec, webhook dupliqué, webhook tardif, remboursement partiel.
