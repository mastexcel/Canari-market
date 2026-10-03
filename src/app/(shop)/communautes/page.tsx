import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listCommunities, userCommunities } from "@/application/community.service";
import { PageHeader } from "@/ui/Card";
import { ButtonLink } from "@/ui/Button";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";

export const metadata = { title: "Communautés" };

const TYPES: Record<string, string> = { NEIGHBORHOOD: "Quartier", RESIDENCE: "Résidence", COMPANY: "Entreprise", ASSOCIATION: "Association", OTHER: "Groupe" };

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const user = await currentUser();
  const [all, mine] = await Promise.all([listCommunities({ commune: user?.commune, q }), user ? userCommunities(user.id) : Promise.resolve([])]);
  const mineIds = new Set(mine.map((m) => m.communityId));
  return (
    <div className="space-y-4">
      <PageHeader title="Communautés" subtitle="Achetez avec vos voisins, collègues ou votre association : plus de volume, plus d'avantages." action={user ? <ButtonLink href="/communautes/nouvelle" size="sm">Créer</ButtonLink> : undefined} />
      {mine.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Mes communautés</h2>
          <ul className="space-y-2">
            {mine.map((m) => (
              <li key={m.id}>
                <Link href={`/communautes/${m.community.slug}`} className="flex items-center justify-between rounded-[var(--radius-card)] bg-brand-600 p-3 text-white">
                  <span className="font-semibold">{m.community.name}</span>
                  {m.role === "ADMIN" && <Badge tone="accent">Admin</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form role="search">
        <label htmlFor="cq" className="sr-only">
          Chercher une communauté
        </label>
        <input id="cq" name="q" defaultValue={q} placeholder="Chercher (Angré, Niangon, entreprise…)" className="h-11 w-full rounded-xl border border-gris-300 bg-white px-4" />
      </form>
      {all.length === 0 ? (
        <EmptyState title="Aucune communauté trouvée" emoji="🏘️" action={user ? <ButtonLink href="/communautes/nouvelle">Créer la vôtre</ButtonLink> : undefined} />
      ) : (
        <ul className="space-y-2">
          {all.map((c) => (
            <li key={c.id}>
              <Link href={`/communautes/${c.slug}`} className="block rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{c.name}</p>
                  {mineIds.has(c.id) ? <Badge tone="economie">Membre</Badge> : <Badge>{TYPES[c.type]}</Badge>}
                </div>
                <p className="mt-1 text-sm text-anthracite-600">
                  📍 {c.commune}
                  {c.quartier ? ` · ${c.quartier}` : ""} · 👥 {c.memberCount} membres
                  {c.pickupPoint ? ` · ${c.pickupPoint.name}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
