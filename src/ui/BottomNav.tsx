"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";

const ITEMS = [
  { href: "/", label: "Accueil", icon: HomeIcon, match: (p: string) => p === "/" },
  { href: "/achats-groupes", label: "Achats groupés", icon: GroupIcon, match: (p: string) => p.startsWith("/achats-groupes") },
  { href: "/panier", label: "Panier", icon: CartIcon, match: (p: string) => p.startsWith("/panier") || p.startsWith("/checkout") },
  { href: "/commandes", label: "Commandes", icon: BoxIcon, match: (p: string) => p.startsWith("/commandes") },
  { href: "/compte", label: "Compte", icon: UserIcon, match: (p: string) => p.startsWith("/compte") || p.startsWith("/notifications") || p.startsWith("/support") },
];

export function BottomNav({ cartCount }: { cartCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-0 z-40 border-t border-gris-200 bg-white/95 pb-[var(--safe-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-16 flex-col items-center justify-center gap-0.5 text-[12px] font-bold", active ? "text-brand-700" : "text-anthracite-600")}
              >
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition-colors", active && "capsule-foret shadow-sm")}>
                  <Icon active={active} />
                </span>
                <span className="leading-none">{it.label}</span>
                {it.href === "/panier" && cartCount > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 grid min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-anthracite-900" aria-label={`${cartCount} articles`}>
                    {cartCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Svg({ children, active }: { children: React.ReactNode; active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
function HomeIcon({ active }: { active: boolean }) {
  return <Svg active={active}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>;
}
function GroupIcon({ active }: { active: boolean }) {
  return <Svg active={active}><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c3 0 6 1.8 6 5" /></Svg>;
}
function CartIcon({ active }: { active: boolean }) {
  return <Svg active={active}><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></Svg>;
}
function BoxIcon({ active }: { active: boolean }) {
  return <Svg active={active}><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></Svg>;
}
function UserIcon({ active }: { active: boolean }) {
  return <Svg active={active}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></Svg>;
}
