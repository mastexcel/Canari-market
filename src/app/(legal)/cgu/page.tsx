import Link from "next/link";

export const metadata = {
  title: "Conditions générales d’utilisation et de vente",
  description: "Règles des achats groupés Sesam-Market : prix, paiement, remboursements, retrait et livraison.",
};

/* Les éléments entre crochets sont à compléter par l'éditeur avant le lancement. */
export default function CguPage() {
  return (
    <>
      <h1 className="text-2xl">Conditions générales d’utilisation et de vente</h1>
      <p className="text-sm text-anthracite-600">Version 1, en vigueur au 3 octobre 2026</p>

      <h2 className="pt-2 text-lg">1. Objet</h2>
      <p>Sesam-Market est une centrale d’achat numérique : elle regroupe la demande des ménages et petits commerces d’Abidjan, achète en gros auprès de fournisseurs vérifiés, fractionne les volumes et les met à disposition en point relais ou à domicile. Les présentes conditions s’appliquent à toute utilisation du site et de l’application.</p>

      <h2 className="pt-2 text-lg">2. Compte</h2>
      <p>L’inscription est gratuite et réservée aux personnes majeures. Vous êtes responsable de la confidentialité de votre mot de passe et de l’exactitude de vos informations. Un seul compte par personne.</p>

      <h2 className="pt-2 text-lg">3. Achats groupés et prix</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Chaque achat groupé affiche un objectif de quantité, des paliers de prix et une date de clôture.</li>
        <li>Vous payez au plus le <strong>prix plafond</strong> affiché. Si un palier plus avantageux est atteint à la clôture, la différence vous est <strong>remboursée automatiquement</strong>. Le prix ne peut jamais augmenter après votre paiement.</li>
        <li>Les règles en cas d’objectif non atteint (prolongation, remboursement, prix alternatif ou avoir avec votre accord) sont affichées <strong>avant</strong> le paiement et s’appliquent à l’achat concerné.</li>
        <li>Les économies affichées sont calculées à partir de prix de référence datés et sourcés ; un relevé trop ancien n’est pas compté.</li>
      </ul>

      <h2 className="pt-2 text-lg">4. Paiement</h2>
      <p>Le paiement s’effectue par Mobile Money ou carte via un prestataire agréé. Sesam-Market ne conserve aucune donnée bancaire. Une commande n’est confirmée qu’après validation du paiement par le prestataire.</p>

      <h2 className="pt-2 text-lg">5. Retrait et livraison</h2>
      <p>Au point relais, la commande est remise sur présentation du code ou du QR de retrait. À domicile, le livreur demande un code de confirmation. Les délais indiqués sont estimatifs. Une commande non retirée dans le délai indiqué peut être retournée et remboursée, déduction faite des frais annoncés.</p>

      <h2 className="pt-2 text-lg">6. Réclamations et remboursements</h2>
      <p>
        Produit manquant, abîmé ou non conforme : signalez-le depuis la commande ou la page{" "}
        <Link className="font-semibold text-brand-700 underline" href="/support">
          Aide &amp; support
        </Link>{" "}
        dans les 48 heures suivant le retrait. Les remboursements sont effectués sur le moyen de paiement d’origine.
      </p>

      <h2 className="pt-2 text-lg">7. Parrainage et communautés</h2>
      <p>Les avantages de parrainage sont attribués après le premier achat payé du filleul. Toute fraude (comptes multiples, auto-parrainage) entraîne l’annulation des avantages et peut entraîner la suspension du compte. Les communautés doivent rester courtoises ; les contenus illicites sont supprimés.</p>

      <h2 className="pt-2 text-lg">8. Responsabilité</h2>
      <p>Sesam-Market s’engage à fournir des produits conformes à leur description et sélectionne ses fournisseurs. Sa responsabilité ne saurait être engagée en cas de force majeure ou d’usage non conforme des produits.</p>

      <h2 className="pt-2 text-lg">9. Données personnelles</h2>
      <p>
        Voir la{" "}
        <Link className="font-semibold text-brand-700 underline" href="/confidentialite">
          politique de confidentialité
        </Link>
        .
      </p>

      <h2 className="pt-2 text-lg">10. Droit applicable</h2>
      <p>Les présentes conditions sont régies par le droit ivoirien. En cas de litige, une solution amiable est recherchée en priorité ; à défaut, les tribunaux d’Abidjan sont compétents. [Médiateur de la consommation à préciser.]</p>
    </>
  );
}
