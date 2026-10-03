export const metadata = { title: "Mentions légales", description: "Éditeur et hébergeur du site Sesam-Market." };

/* Les éléments entre crochets sont à compléter par l'éditeur avant le lancement. */
export default function MentionsLegalesPage() {
  return (
    <>
      <h1 className="text-2xl">Mentions légales</h1>
      <h2 className="pt-2 text-lg">Éditeur</h2>
      <p>
        Sesam-Market — [forme juridique et capital], RCCM [numéro], [adresse du siège], Abidjan, Côte d’Ivoire.
        <br />
        Directeur de la publication : [nom].
        <br />
        Contact :{" "}
        <a className="font-semibold text-brand-700 underline" href="mailto:contact@sesam-market.ci">
          contact@sesam-market.ci
        </a>
      </p>
      <h2 className="pt-2 text-lg">Hébergement</h2>
      <p>Render Services, Inc. — 525 Brannan Street, Suite 300, San Francisco, CA 94107, États-Unis (serveurs situés à Francfort, Allemagne).</p>
      <h2 className="pt-2 text-lg">Propriété intellectuelle</h2>
      <p>La marque, le logo et les contenus de Sesam-Market sont protégés. Toute reproduction sans autorisation est interdite.</p>
    </>
  );
}
