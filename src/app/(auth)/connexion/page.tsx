import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { homePathFor } from "@/domain/permissions";
import { FullLogo } from "@/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Connexion" };

/** N'accepte que des chemins internes (anti « open redirect »). */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const next = safeNext((await searchParams).suite);
  const user = await currentUser();
  if (user) redirect(next ?? homePathFor(user.role));
  return (
    <div>
      <Link href="/" aria-label="Accueil" className="block">
        <FullLogo halo width={240} className="mx-auto h-auto w-56" />
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold">Connexion</h1>
      <p className="mt-1 text-anthracite-600">Content de vous revoir !</p>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm">
        Pas encore de compte ?{" "}
        <Link href={`/inscription${next ? `?suite=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 underline">
          Inscrivez-vous
        </Link>
      </p>
      <details className="mt-8 rounded-xl bg-white p-3 text-xs text-anthracite-600">
        <summary className="cursor-pointer font-semibold">Comptes de démonstration</summary>
        {/* Démo hébergée : le mot de passe est privé (DEMO_PASSWORD), il n'est jamais affiché. */}
        <p className="mt-2">{process.env.DEMO_PASSWORD ? "Mot de passe : celui communiqué par l'administrateur." : <>Mot de passe pour tous : <code>sesam2026</code></>}</p>
        <ul className="mt-1 space-y-0.5">
          <li>Ménage : 07 00 00 00 01</li>
          <li>Admin : 07 00 00 00 99</li>
          <li>Fournisseur : 05 00 00 00 01</li>
          <li>Livreur : 01 00 00 00 01</li>
          <li>Point relais : 01 00 00 01 01</li>
        </ul>
      </details>
    </div>
  );
}
