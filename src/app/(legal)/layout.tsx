import Link from "next/link";
import { Logo } from "@/ui/Logo";
import { LegalFooter } from "@/ui/LegalFooter";

/** Pages légales : publiques, lisibles sans compte, sans navigation d'application. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-gris-200 bg-white">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Link href="/" aria-label="Accueil Sesam-Market">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="contenu" data-fond="sable" className="mx-auto max-w-2xl px-4 py-6">
        <article className="legal space-y-4 rounded-[var(--radius-card)] bg-white p-5 text-[15px] leading-relaxed text-anthracite-800 shadow-[var(--shadow-card)] sm:p-8">{children}</article>
        <LegalFooter className="mt-6" />
      </main>
    </>
  );
}
