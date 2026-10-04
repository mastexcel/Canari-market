import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { COMMUNES } from "@/application/schemas";
import { FullLogo } from "@/ui/Logo";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Inscription" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ref?: string; suite?: string }> }) {
  const { ref, suite } = await searchParams;
  if (await currentUser()) redirect("/");
  const next = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : null;
  return (
    <div>
      <Link href="/" aria-label="Accueil" className="block">
        <FullLogo halo width={240} className="mx-auto h-auto w-56" />
      </Link>
      <h1 className="mt-4 text-2xl font-extrabold">Créer mon compte</h1>
      <p className="mt-1 text-anthracite-600">Une minute pour commencer à économiser avec votre quartier.</p>
      <SignupForm communes={[...COMMUNES]} referralCode={ref?.slice(0, 20) ?? ""} next={next} />
      <p className="mt-6 text-center text-sm">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-brand-700 underline">
          Connexion
        </Link>
      </p>
    </div>
  );
}
