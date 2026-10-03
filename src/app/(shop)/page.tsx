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
    <div className="space-y-8">
      {/* Accroche : le groupe → le volume → le prix → l'économie */}
      <section className="brand-pattern relative -mx-4 -mt-4 overflow-hidden px-4 pt-6 pb-6 text-white">
        <Image src={heroImage ?? "/brand/mark.webp"} alt="" width={heroImage ? 260 : 170} height={heroImage ? 260 : 114} priority className={heroImage ? "pointer-events-none absolute -right-8 -bottom-2 w-44 opacity-95" : "pointer-events-none absolute -top-1 -right-6 w-40 opacity-95 drop-shadow-[0_10px_18px_rgba(0,0,0,0.25)]"} />
        <p className="relative text-sm font-semibold text-accent-400">{user ? `Bonjour ${user.firstName} 👋` : "Bienvenue chez Sesam-Market"}</p>
        <h1 className="relative mt-1 max-w-[15rem] text-[28px] leading-[1.1] font-black">
          À plusieurs, <span className="text-accent-400">les prix s’ouvrent.</span>
        </h1>
        <p className="relative mt-2 max-w-[17rem] text-sm text-white/80">Plus nous sommes nombreux à acheter ensemble, plus le prix baisse — pour tout le monde.</p>
        {mine && mine.total > 0 && (
          <Link href="/compte/economies" className="relative mt-4 flex items-center justify-between rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur-sm">
            <span className="text-sm">Vous avez économisé</span>
            <strong className="text-lg text-accent-400">{formatFcfa(mine.total)}</strong>
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
      </section>

      {/* Les 4 promesses du logo */}
      <ul className="-mt-4 grid grid-cols-4 gap-2" aria-label="Nos services">
        {[
          { e: "👨‍👩‍👧", t: "Achats groupés", href: "/achats-groupes", icon: "achats-groupes" },
          { e: "🚚", t: "Livraison à domicile", href: "/points-relais", icon: "livraison-domicile" },
          { e: "📍", t: "Points relais", href: "/points-relais", icon: "points-relais" },
          { e: "🛡️", t: "Produits pour tous", href: "/categories", icon: "produits-pour-tous" },
        ].map((f) => ({ ...f, img: iconImage(f.icon) })).map((f) => (
          <li key={f.t}>
            <Link href={f.href} className="flex h-full flex-col items-center gap-1 rounded-2xl bg-white/90 px-1 py-2.5 text-center shadow-[var(--shadow-card)] ring-1 ring-brand-100 backdrop-blur">
              <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-lime-100 to-accent-100 text-lg" aria-hidden>
                {f.img ? <Image src={f.img} alt="" width={36} height={36} /> : f.e}
              </span>
              <span className="text-[10.5px] leading-tight font-extrabold tracking-wide text-brand-800 uppercase">{f.t}</span>
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
                <span className="text-xs leading-tight font-semibold text-anthracite-800">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {upcoming.length > 0 && (
        <aside className="flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-lime-500/50 bg-lime-100/60 px-4 py-3" aria-label="Bientôt">
          <span className="flex -space-x-1 text-2xl" aria-hidden>
            {upcoming.map((c) => (
              <span key={c.slug}>{c.emoji}</span>
            ))}
          </span>
          <p className="text-sm text-anthracite-800">
            <strong className="text-brand-800">Pour commencer : le non-périssable.</strong> Riz, huile, sucre, entretien, hygiène, fournitures…{" "}
            <span className="text-anthracite-600">Les produits frais arrivent bientôt.</span>
          </p>
        </aside>
      )}

      <section>
        <SectionTitle title="Achats groupés en cours" subtitle="Rejoignez le groupe, faites baisser le prix." action={<Link href="/achats-groupes" className="text-sm font-semibold text-brand-700">Tout voir</Link>} />
        {groupBuys.length ? (
          <div className="space-y-3">
            {groupBuys.map((gb) => (
              <GroupBuyCard key={gb.id} gb={gb} />
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
        <SectionTitle title="Produits populaires" action={<Link href="/categories" className="text-sm font-semibold text-brand-700">Catalogue</Link>} />
        <div className="grid grid-cols-2 gap-3">
          {popular.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {communities.length > 0 && (
        <section>
          <SectionTitle title="Communautés proches" subtitle={user?.commune ? `Autour de ${user.commune}` : "Achetez avec vos voisins, collègues, associations."} action={<Link href="/communautes" className="text-sm font-semibold text-brand-700">Tout voir</Link>} />
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

      <section className="rounded-[var(--radius-card)] bg-economie-600 p-5 text-white">
        <p className="text-sm text-white/85">Ensemble, la communauté Sesam-Market a déjà économisé</p>
        <p className="mt-1 text-3xl font-extrabold tabular">{formatFcfa(platform.total)}</p>
        <p className="mt-1 text-sm text-white/85">
          {platform.households} ménages · {formatFcfa(platform.average)} en moyenne par ménage
        </p>
      </section>
    </div>
  );
}
