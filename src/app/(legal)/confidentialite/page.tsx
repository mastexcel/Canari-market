import Link from "next/link";

export const metadata = {
  title: "Politique de confidentialité",
  description: "Quelles données Sesam-Market collecte, pourquoi, combien de temps, et comment exercer vos droits.",
};

/*
 * Base : loi ivoirienne n° 2013-450 relative à la protection des données à caractère
 * personnel (autorité de contrôle : ARTCI) et RGPD pour les personnes situées dans l'UE.
 * Les éléments entre crochets sont à compléter par l'éditeur avant le lancement.
 */
export default function ConfidentialitePage() {
  return (
    <>
      <h1 className="text-2xl">Politique de confidentialité</h1>
      <p className="text-sm text-anthracite-600">Version 1 — en vigueur au 3 octobre 2026</p>

      <h2 className="pt-2 text-lg">1. Qui est responsable de vos données ?</h2>
      <p>
        Le responsable du traitement est Sesam-Market, [forme juridique, RCCM, adresse du siège à compléter], Abidjan, Côte d’Ivoire. Contact données personnelles :{" "}
        <a className="font-semibold text-brand-700 underline" href="mailto:confidentialite@sesam-market.ci">
          confidentialite@sesam-market.ci
        </a>
        .
      </p>

      <h2 className="pt-2 text-lg">2. Données collectées et pourquoi</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Compte</strong> : prénom, numéro de téléphone, commune et quartier, composition du foyer (facultatif) — pour créer votre compte et vous proposer les achats groupés de votre zone.</li>
        <li><strong>Commandes et livraison</strong> : articles, montants, point relais ou adresse de livraison — pour exécuter vos commandes (base légale : contrat).</li>
        <li><strong>Paiement</strong> : nous ne stockons <strong>aucune donnée bancaire</strong> ni code Mobile Money. Le paiement est traité par le prestataire agréé ; nous conservons seulement sa référence de transaction.</li>
        <li><strong>Sécurité</strong> : adresse IP et journaux techniques, pour prévenir la fraude et les abus (intérêt légitime).</li>
        <li><strong>Mesure d’audience</strong> : événements anonymes d’usage (par exemple « achat groupé consulté »), sans nom ni téléphone, pour améliorer le service.</li>
        <li><strong>Messages promotionnels</strong> (SMS, WhatsApp) : uniquement avec votre accord, retirable à tout moment.</li>
      </ul>

      <h2 className="pt-2 text-lg">3. Ce que nous ne faisons jamais</h2>
      <p>Nous ne vendons pas vos données et vos achats individuels ne sont jamais transmis comme données personnelles. Les études partagées avec des partenaires (fournisseurs, producteurs) sont agrégées et anonymisées.</p>

      <h2 className="pt-2 text-lg">4. Destinataires</h2>
      <p>Seules les personnes qui en ont besoin y ont accès : l’équipe Sesam-Market habilitée, le point relais ou le livreur de votre commande (prénom, code de retrait, adresse), le prestataire de paiement et notre hébergeur, tenus à la confidentialité.</p>

      <h2 className="pt-2 text-lg">5. Durées de conservation</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Données de compte : tant que le compte est actif, puis suppression ou anonymisation.</li>
        <li>Pièces comptables (commandes, factures) : 10 ans, obligation légale, détachées de votre identité après suppression du compte.</li>
        <li>Journaux de sécurité : 12 mois au plus.</li>
      </ul>

      <h2 className="pt-2 text-lg">6. Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les rectifier, les exporter, demander leur suppression, retirer vos consentements et vous opposer à la prospection. La plupart de ces actions se font directement depuis{" "}
        <Link className="font-semibold text-brand-700 underline" href="/compte/confidentialite">
          Mon compte → Confidentialité
        </Link>
        , ou par e-mail. Vous pouvez aussi saisir l’ARTCI (Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire), autorité de protection des données.
      </p>

      <h2 id="cookies" className="scroll-mt-20 pt-2 text-lg">
        7. Cookies
      </h2>
      <p>Sesam-Market n’utilise que des cookies <strong>strictement nécessaires</strong>, déposés par notre propre site :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li><code>sesam_session</code> : vous garder connecté (sécurisé, inaccessible aux scripts).</li>
        <li><code>sesam_onboarded</code> : ne pas réafficher la présentation à chaque visite.</li>
        <li><code>sesam_cookies</code> : mémoriser que vous avez lu le bandeau d’information.</li>
      </ul>
      <p>Aucun cookie publicitaire, aucun traceur tiers (réseaux sociaux, régies). Si nous en ajoutions, votre accord préalable serait demandé.</p>

      <h2 className="pt-2 text-lg">8. Sécurité</h2>
      <p>Connexion chiffrée (HTTPS), mots de passe hachés, accès du personnel limités et journalisés, sauvegardes régulières.</p>

      <h2 className="pt-2 text-lg">9. Modifications</h2>
      <p>En cas de changement important, nous vous prévenons dans l’application et vous demandons, si nécessaire, un nouvel accord.</p>
    </>
  );
}
