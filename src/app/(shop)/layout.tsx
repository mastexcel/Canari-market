import Link from "next/link";
import { currentUser } from "@/lib/session";
import { cartCount } from "@/application/cart.service";
import { unreadCount } from "@/application/notification.service";
import { BottomNav } from "@/ui/BottomNav";
import { Logo } from "@/ui/Logo";
import { LegalFooter } from "@/ui/LegalFooter";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const [count, unread] = user ? await Promise.all([cartCount(user.id), unreadCount(user.id)]) : [0, 0];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 shadow-[0_4px_18px_-12px_rgb(0_0_0/0.35)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-lg items-center md:max-w-2xl lg:max-w-4xl justify-between gap-2 px-4">
          <Link href="/" aria-label="Accueil Sesam-Market">
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <Link href="/communautes" className="flex h-9 items-center gap-1 rounded-full bg-brand-50 px-3 text-sm font-semibold text-brand-700" aria-label="Communautés">
              <span aria-hidden>👥</span> <span className="hidden min-[400px]:inline">Communautés</span>
            </Link>
            {user ? (
              <Link href="/notifications" className="relative grid size-9 place-items-center rounded-full bg-gris-100" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
                <span aria-hidden>🔔</span>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
              </Link>
            ) : (
              <Link href="/connexion" className="h-9 rounded-full bg-brand-600 px-3 text-sm leading-9 font-semibold text-white">
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-lg px-4 pt-4 pb-28 md:max-w-2xl lg:max-w-4xl">
        {children}
        <LegalFooter className="mt-10" />
      </main>
      <BottomNav cartCount={count} />
    </>
  );
}
