import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";
import { ProNav } from "./ProNav";
import { ProLogout } from "./ProLogout";

export interface NavItem {
  href: string;
  label: string;
  emoji: string;
}

/** Coque des espaces professionnels : barre latérale (bureau) / onglets défilants (mobile). */
export function ProShell({ title, user, nav, children }: { title: string; user: string; nav: NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="border-b border-gris-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:py-5">
          <Link href="/" aria-label="Accueil Sesam-Market">
            <Logo />
          </Link>
          <p className="text-xs font-semibold tracking-wide text-accent-700 uppercase lg:mt-2">{title}</p>
        </div>
        <ProNav items={nav} />
        <div className="hidden px-4 py-4 text-xs text-anthracite-600 lg:block">
          <p className="mb-2">Connecté : {user}</p>
          <ProLogout />
        </div>
      </aside>
      <main id="contenu" className="min-w-0 flex-1 px-4 py-5 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "economie" | "brand" | "alerte" }) {
  const toneClass = tone === "economie" ? "bg-economie-600 text-white" : tone === "brand" ? "bg-brand-700 text-white" : tone === "alerte" ? "bg-alerte-100 text-alerte-700" : "bg-white";
  return (
    <div className={`rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ${toneClass}`}>
      <p className={`text-xs ${tone && tone !== "alerte" ? "text-white/85" : "text-anthracite-600"}`}>{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular">{value}</p>
      {hint && <p className={`mt-0.5 text-xs ${tone && tone !== "alerte" ? "text-white/80" : "text-anthracite-500"}`}>{hint}</p>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-gris-50 text-xs text-anthracite-600 uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gris-200">{children}</tbody>
      </table>
      {empty && <p className="p-6 text-center text-sm text-anthracite-500">Aucun élément.</p>}
    </div>
  );
}

export function H1({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold">{children}</h1>
      {action}
    </div>
  );
}
