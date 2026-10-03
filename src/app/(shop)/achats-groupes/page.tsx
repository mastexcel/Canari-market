import { listOpenGroupBuys } from "@/application/group-buy.service";
import { listCategories } from "@/application/catalog.service";
import Link from "next/link";
import { PageHeader } from "@/ui/Card";
import { GroupBuyCard } from "@/ui/shop/GroupBuyCard";
import { EmptyState } from "@/ui/EmptyState";
import { cn } from "@/ui/cn";

export const metadata = { title: "Achats groupés" };

export default async function GroupBuysPage({ searchParams }: { searchParams: Promise<{ categorie?: string }> }) {
  const { categorie } = await searchParams;
  const [gbs, cats] = await Promise.all([listOpenGroupBuys({ categorySlug: categorie }), listCategories()]);
  return (
    <div>
      <PageHeader title="Achats groupés" subtitle="Chaque participation rapproche tout le groupe du prochain prix." />
      <nav aria-label="Filtrer par catégorie" className="scrollbar-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {[{ slug: "", name: "Tous", emoji: "✨" }, ...cats].map((c) => (
          <Link
            key={c.slug || "all"}
            href={c.slug ? `/achats-groupes?categorie=${c.slug}` : "/achats-groupes"}
            aria-current={(categorie ?? "") === c.slug ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold", (categorie ?? "") === c.slug ? "capsule-foret shadow-[var(--shadow-card)]" : "capsule-sable text-anthracite-800 ring-1 ring-sable-300")}
          >
            {c.emoji} {c.name}
          </Link>
        ))}
      </nav>
      {gbs.length ? (
        <div className="space-y-3">
          {gbs.map((gb, i) => (
            <GroupBuyCard key={gb.id} gb={gb} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState title="Aucun achat groupé ici pour l'instant" emoji="🕊️">
          Revenez bientôt ou créez une communauté pour proposer un achat à vos voisins.
        </EmptyState>
      )}
    </div>
  );
}
