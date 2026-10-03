import Link from "next/link";

export function BackLink({ href, label = "Retour" }: { href: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-xl shadow-[var(--shadow-card)]">
      ←
    </Link>
  );
}
