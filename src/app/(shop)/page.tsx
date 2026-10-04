import Image from "next/image";
import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listOpenGroupBuys } from "@/application/group-buy.service";
import { bestSavings, listBaskets, listCategories, searchProducts, upcomingCategories } from "@/application/catalog.service";
import { listCommunities } from "@/application/community.service";
import { platformSavings, userSavings } from "@/application/savings.service";
import { formatFcfa, formatBps } from "@/domain/money";
import { categoryImage, iconImage, illustration } from "@/infrastructure/assets";
import { SectionTitle } from "@/ui/Card";
import { GroupBuyCard } from "@/ui/shop/GroupBuyCard";
import { ProductCard } from "@/ui/shop/ProductCard";
import { HowItWorks } from "@/ui/shop/HowItWorks";
import { EmptyState } from "@/ui/EmptyState";
import { ButtonLink } from "@/ui/Button";

export default async function HomePage() {
  const user = await currentUser();
  const [groupBuys, categories, savers, baskets, popular, communities, platform, mine, upcoming] = await Promise.all([
    listOpenGroupBuys({ take: 4 }),
    listCategories(),
    bestSavings(6),
    listBaskets(),
    searchProducts({ take: 6, sort: "popular" }),
    listCommunities({ commune: user?.commune }),
    platformSavings(),
    user ? userSavings(user.id) : Promise.resolve(null),
    upcomingCategories(),
  ]);

  const heroImage = illustration("hero", "accueil");
  return (
    <div className="space-y-8" data-fond="accueil">
      {/* Accroche : le groupe → le volume → le prix → l'économie */}
      <section className="relative -mx-4 -mt-4 overflow-hidden px-4 pt-6 pb-8 text-anthracite-900">
        {heroImage ? (
          // Illustration du groupe dans un « soleil » aux couleurs du wax
          <div aria-hidden className="pointer-events-none absolute top-5 -right-7 size-44 min-[400px]:size-48">
            <svg className="animate-spin-slow absolute inset-0 size-full" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="96" fill="none" stroke="#FF9A3D" strokeWidth="4" strokeDasharray="3 10" strokeLinecap="round" />
              <circle cx="100" cy="100" r="87" fill="none" stroke="#A9B84A" strokeOpacity=".6" strokeWidth="2" strokeDasharray="16 8" />
            </svg>
            <div className="absolute inset-[11%] overflow-hidden rounded-full shadow-[0_14px_30px_-12px_rgba(0,0,0,0.5)] ring-4 ring-accent-400">
              <Image src={heroImage} alt="" fill sizes="200px" priority className="object-cover" />
            </div>
          </div>
        ) : (
          <Image src="/brand/mark.webp" alt="" width={170} height={114} priority className="pointer-events-none absolute -top-1 -right-6 w-40 opacity-95 drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]" />
        )}
        <p className="relative text-sm font-semibold text-accent-700">{user ? `Bonjour ${user.firstName} 👋` : "Bienvenue chez Sesam-Market"}</p>
        <h1 className="relative mt-1 max-w-[13.5rem] text-[29px] leading-[1.1] font-bold">
          À plusieurs, <span className="text-brand-600">les prix s’ouvrent.</span>
        </h1>
        <p className="relative mt-2 max-w-[13.5rem] text-sm text-anthracite-700">Plus nous sommes nombreux à acheter ensemble, plus le prix baisse — pour tout le monde.</p>
        {mine && mine.total > 0 && (
          <Link href="/compte/economies" className="relative mt-4 flex items-center justify-between rounded-2xl bg-white/80 p-3 shadow-[var(--shadow-card)] ring-1 ring-brand-200 backdrop-blur-sm">
            <span className="text-sm">Vous avez économisé</span>
            <strong className="text-lg text-accent-700">{formatFcfa(mine.total)}</strong>
          </Link>
        )}
        <form action="/recherche" className="relative mt-4" role="search">
          <label htmlFor="q" className="sr-only">
            Rechercher un produit
          </label>
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-anthracite-500" aria-hidden>
            🔍
          </span>
          <input id="q" name="q" type="search" placeholder="Riz, huile, savon, cahiers…" className="h-12 w-full rounded-[1.1rem_1.1rem_1.1rem_0.4rem] bg-white pr-4 pl-10 text-anthracite-900 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.45)] placeholder:text-anthracite-500" />
        </form>
        {/* Action principale de la page */}
        <ButtonLink href="/achats-groupes" variant="accent" size="lg" block className="relative mt-3">
          Rejoindre un achat groupé →
        </ButtonLink>
        {platform.households > 0 && (
          <p className="relative mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold text-anthracite-800">
            <span>👥 {platform.households.toLocaleString("fr-FR")} ménages</span>
            <span aria-hidden>•</span>
            <span>💰 {formatFcfa(platform.total)} économisés ensemble</span>
          </p>
        )}
        <div aria-hidden className="kente-band absolute inset-x-4 bottom-0 rounded-full opacity-90" />
      </section>

      {/* Les 4 promesses du logo */}
      <ul className="-mt-4 grid grid-cols-4 gap-2" aria-label="Nos services">
        {[
          { e: "👨‍👩‍👧", t: "Achats groupés", href: "/achats-groupes", icon: "achats-groupes", tone: "capsule-foret" },
          { e: "🚚", t: "Livraison à domicile", href: "/points-relais", icon: "livraison-domicile", tone: "capsule-terre" },
          { e: "📍", t: "Points relais", href: "/points-relais", icon: "points-relais", tone: "capsule-lagune" },
          { e: "🛡️", t: "Produits pour tous", href: "/categories", icon: "produits-pour-tous", tone: "capsule-nuit" },
        ].map((f) => ({ ...f, img: iconImage(f.icon) })).map((f) => (
          <li key={f.t}>
            <Link href={f.href} className={`${f.tone} flex h-full flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center shadow-[var(--shadow-card)] ring-2 ring-white transition-transform hover:-translate-y-0.5`}>
              <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-white text-lg shadow-sm" aria-hidden>
                {f.img ? <Image src={f.img} alt="" width={36} height={36} /> : f.e}
              </span>
              <span className="text-[11.5px] leading-tight font-extrabold tracking-[0.02em] uppercase">{f.t}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="cats">
        <h2 id="cats" className="sr-only">
          Catégories
        </h2>
        <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4">
          {categories.map((c) => (
            <li key={c.id} className="shrink-0">
              <Link href={`/categories/${c.slug}`} className="flex w-20 flex-col items-center gap-1 text-center">
                <span className="grid size-16 place-items-center overflow-hidden rounded-2xl bg-white text-3xl shadow-[var(--shadow-card)]" aria-hidden>
                  {categoryImage(c.slug) ? <Image src={categoryImage(c.slug)!} alt="" width={64} height={64} className="size-16 object-cover" /> : c.emoji}
                </span>
                <span className="text-xs leading-tight font-semibold text-anthracite-900">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <aside className="capsule-soleil flex items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 shadow-[var(--shadow-card)]" aria-label="Bientôt">
          <span className="flex -space-x-1 text-2xl" aria-hidden>
            {upcoming.map((c) => (
              <span key={c.slug}>{c.emoji}</span>
            ))}
          </span>
          <p className="text-sm text-anthracite-950">
            <strong>Pour commencer : le non-périssable.</strong> Riz, huile, sucre, entretien, hygiène, fournitures…{" "}
            <span className="font-semibold">Les produits frais arrivent bientôt.</span>
          </p>
        </aside>
      )}

      <section>
        <SectionTitle title="Achats groupés en cours" subtitle="Rejoignez le groupe, faites baisser le prix." action={<Link href="/achats-groupes" className="shrink-0 text-sm font-semibold whitespace-nowrap text-brand-700 underline-offset-2 hover:underline">Tout voir</Link>} />
        {groupBuys.length ? (
          <div className="space-y-3">
            {groupBuys.map((gb, i) => (
              <GroupBuyCard key={gb.id} gb={gb} index={i} />
            ))}
          </div>
        ) : (
          <EmptyState title="Aucun achat groupé ouvert" emoji="🕊️">
            Les prochains achats groupés arrivent bientôt.
          </EmptyState>
        )}
      </section>

      {savers.length > 0 && (
        <section>
          <SectionTitle title="Meilleures économies" subtitle="Comparées à des relevés de prix récents et datés." />
          <div className="grid grid-cols-2 gap-3">
            {savers.slice(0, 4).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {baskets.length > 0 && (
        <section>
          <SectionTitle title="Paniers famille" subtitle="L'essentiel de la maison, déjà composé — modifiable." />
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4">
            {baskets.map((b) => (
              <Link key={b.id} href={`/paniers-famille/${b.slug}`} className="w-64 shrink-0 snap-start rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
                <p className="text-xs font-semibold tracking-wide text-accent-700 uppercase">{b.householdHint}</p>
                <p className="mt-1 text-lg font-extrabold">{b.name}</p>
                <p className="mt-2 text-sm text-anthracite-600">
                  Valeur au détail : <span className="line-through">{formatFcfa(b.referenceTotal)}</span>
                </p>
                <p className="text-xl font-extrabold text-brand-700">{formatFcfa(b.canariTotal)}</p>
                {b.saving > 0 && (
                  <p className="mt-1 text-sm font-bold text-economie-700">
                    Économie {formatFcfa(b.saving)} · {formatBps(b.savingBps)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Produits populaires" action={<Link href="/categories" className="shrink-0 text-sm font-semibold whitespace-nowrap text-brand-700 underline-offset-2 hover:underline">Catalogue</Link>} />
        <div className="grid grid-cols-2 gap-3">
          {popular.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {communities.length > 0 && (
        <section>
          <SectionTitle title="Communautés proches" subtitle={user?.commune ? `Autour de ${user.commune}` : "Achetez avec vos voisins, collègues, associations."} action={<Link href="/communautes" className="shrink-0 text-sm font-semibold whitespace-nowrap text-brand-700 underline-offset-2 hover:underline">Tout voir</Link>} />
          <ul className="space-y-2">
            {communities.slice(0, 3).map((c) => (
              <li key={c.id}>
                <Link href={`/communautes/${c.slug}`} className="flex items-center justify-between rounded-[var(--radius-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    <span className="text-xs text-anthracite-600">
                      {c.commune}
                      {c.quartier ? ` · ${c.quartier}` : ""} · {c.memberCount} membres
                    </span>
                  </span>
                  <span aria-hidden className="text-brand-600">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle title="Comment ça marche ?" />
        <HowItWorks />
      </section>

      <section className="capsule-lagune rounded-[var(--radius-card)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-sm text-white">Ensemble, la communauté Sesam-Market a déjà économisé</p>
        <p className="mt-1 text-3xl font-extrabold tabular">{formatFcfa(platform.total)}</p>
        <p className="mt-1 text-sm text-white">
          {platform.households} ménages · {formatFcfa(platform.average)} en moyenne par ménage
        </p>
      </section>
    </div>
  );
}
