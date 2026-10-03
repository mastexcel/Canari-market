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
      <header className="sticky top-0 z-30 border-b border-gris-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between gap-2 px-4">
          <Link href="/" aria-label="Sesam-Market — accueil">
            <Logo />
          </Link>
          <div className="flex items-center gap-1.5">
            <Link href="/communautes" className="flex h-9 items-center gap-1 rounded-full bg-brand-50 px-3 text-sm font-semibold text-brand-700" aria-label="Communautés">
              <span aria-hidden>👥</span> <span className="hidden min-[400px]:inline">Communautés</span>
            </Link>
            {user ? (
              <Link href="/notifications" className="relative grid size-9 place-items-center rounded-full bg-gris-100" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
                <span aria-hidden>🔔</span>
                {unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
              </Link>
            ) : (
              <Link href="/connexion" className="h-9 rounded-full bg-brand-600 px-3 text-sm leading-9 font-semibold text-white">
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="contenu" className="mx-auto max-w-lg px-4 pt-4 pb-28">
        {children}
        <LegalFooter className="mt-10" />
      </main>
      <BottomNav cartCount={count} />
    </>
  );
}
