import Link from "next/link";
import { BrandMark } from "@/ui/Logo";

export default function NotFound() {
  return (
    <main id="contenu" className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <BrandMark size={64} className="mx-auto mb-4" />
        <h1 className="text-xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-anthracite-600">Ce lien n&apos;existe pas ou plus.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
