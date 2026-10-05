# Application mobile Sesam-Market

Application Android et iOS construite avec [Capacitor](https://capacitorjs.com) : une coque native
(icône, écran de démarrage, barre d'état, bouton retour, page hors ligne) qui affiche le site
https://sesam-market.onrender.com. Toute évolution du site est donc visible immédiatement dans
l'application, sans nouvelle publication sur les stores.

## Contenu

| Élément | Où |
|---|---|
| Configuration (identifiant `ci.sesammarket.app`, URL du site, couleurs) | `capacitor.config.json` |
| Page affichée sans connexion | `www/hors-ligne.html` |
| Projet Android (Android Studio) | `android/` |
| Projet iOS (Xcode, macOS requis) | `ios/` |
| Génération des icônes et écrans de démarrage | `scripts/generate-assets.mjs` (`npm run assets`) |
| Intégration côté site (bouton retour, barre d'état) | `../src/ui/NativeBridge.tsx` |

L'application suit la rotation de l'écran (portrait et paysage).

## Compiler

**Android, automatiquement** : chaque modification de `mobile/` lance le workflow
GitHub Actions « Application mobile », qui produit `sesam-market.apk` (onglet Actions →
artefacts, et branche `app-builds`).

**Android, sur un poste** (Node 22, JDK 21, Android Studio) :

```bash
cd mobile
npm install
npx cap sync android
npm run android:apk        # APK de test : android/app/build/outputs/apk/debug/
npx cap open android       # ou ouvrir dans Android Studio
```

**iOS** (Mac avec Xcode) : `npx cap sync ios && npx cap open ios`, puis Product → Archive.

## Publier sur Google Play

1. Créer une clé de signature (une seule fois, à conserver précieusement, jamais dans le dépôt) :
   `keytool -genkey -v -keystore sesam.jks -alias sesam -keyalg RSA -keysize 2048 -validity 10000`
2. Dans GitHub → Settings → Secrets and variables → Actions, ajouter :
   `SESAM_KEYSTORE_BASE64` (contenu de `base64 -w0 sesam.jks`), `SESAM_KEYSTORE_PASSWORD`,
   `SESAM_KEY_ALIAS`, `SESAM_KEY_PASSWORD`.
3. Le workflow produit alors aussi `sesam-market.aab`, à téléverser dans la Google Play Console
   (compte développeur : 25 USD, une fois).

## Publier sur l'App Store

Compte Apple Developer (99 USD/an) et un Mac. Apple refuse les applications qui ne sont qu'un site
dans une coque : avant soumission, prévoir au moins une fonction native (notifications push,
scan du QR de retrait, partage natif…).
