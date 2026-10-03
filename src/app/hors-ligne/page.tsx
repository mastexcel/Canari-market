import { BrandMark } from "@/ui/Logo";

export const metadata = { title: "Hors ligne" };

export default function Offline() {
  return (
    <main id="contenu" className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <BrandMark size={72} className="mx-auto mb-4" />
        <h1 className="text-xl font-bold">Pas de connexion</h1>
        <p className="mt-2 text-anthracite-600">Votre panier et vos commandes sont en sécurité. Réessayez dès que le réseau revient.</p>
        {/* Rechargement complet volontaire : la navigation client ne fonctionne pas hors ligne. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white">
          Réessayer
        </a>
      </div>
    </main>
  );
}
