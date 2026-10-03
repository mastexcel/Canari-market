import Link from "next/link";
import { cn } from "./cn";

const LINKS = [
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/cgu", label: "Conditions d’utilisation" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite#cookies", label: "Cookies" },
];

/** Liens légaux, présents en pied de page de toutes les pages publiques. */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("text-center text-xs text-anthracite-600", className)}>
      <nav aria-label="Informations légales" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="underline-offset-2 hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="mt-2">© {new Date().getFullYear()} Sesam-Market · Abidjan, Côte d’Ivoire</p>
    </footer>
  );
}
