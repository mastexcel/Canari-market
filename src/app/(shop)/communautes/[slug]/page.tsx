import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getCommunity } from "@/application/community.service";
import { DomainError } from "@/domain/errors";
import { formatFcfa } from "@/domain/money";
import { formatWeekday } from "@/domain/dates";
import { COMMUNITY_LEVELS } from "@/domain/community";
import { Card, PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { Badge } from "@/ui/Badge";
import { GroupProgress } from "@/ui/ProgressBar";
import { MembershipButton } from "./MembershipButton";

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  let c;
  try {
    c = await getCommunity(slug, user?.id ?? null);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const { stats } = c;
  return (
    <div className="space-y-4">
      <PageHeader title={c.name} subtitle={`${c.commune}${c.quartier ? ` · ${c.quartier}` : ""}`} back={<BackLink href="/communautes" />} />
      {c.description && <p className="text-sm text-anthracite-700">{c.description}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Membres" value={String(c.memberCount)} />
        <Stat label="Commandes cumulées" value={String(stats.totalOrders)} />
        <Stat label="Économies cumulées" value={formatFcfa(stats.totalSavings)} highlight />
        <Stat label="Prochaine livraison" value={c.nextDelivery ? formatWeekday(c.nextDelivery) : "À définir"} />
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-bold">Niveau de la communauté</p>
          <Badge tone="accent">{stats.level.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-anthracite-700">{stats.level.description}</p>
        {stats.next && (
          <div className="mt-3">
            <GroupProgress percent={(stats.monthlyOrders / stats.next.level.minMonthlyOrders) * 100} label="Progression vers le niveau suivant" size="sm" />
            <p className="mt-1 text-xs text-anthracite-600">
              Encore {stats.next.remainingOrders} commandes ce mois-ci pour le niveau {stats.next.level.label} : {stats.next.level.description}
            </p>
          </div>
        )}
        <details className="mt-3 text-xs text-anthracite-600">
          <summary className="cursor-pointer font-semibold">Tous les niveaux</summary>
          <ul className="mt-1 space-y-0.5">
            {COMMUNITY_LEVELS.map((l) => (
              <li key={l.key}>
                {l.label} ({l.minMonthlyOrders}+ commandes/mois) : {l.description}
              </li>
            ))}
          </ul>
        </details>
      </Card>
      {c.pickupPoint && (
        <Card className="p-4 text-sm">
          <p className="font-bold">📍 Point Sesam de la communauté</p>
          <p className="mt-1">
            {c.pickupPoint.name} — {c.pickupPoint.address}, {c.pickupPoint.quartier}
            <br />
            {c.pickupPoint.openingHours}
          </p>
        </Card>
      )}
      {c.groupBuys.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 font-bold">Achats réservés à la communauté</p>
          <ul className="space-y-1">
            {c.groupBuys.map((g) => (
              <li key={g.slug}>
                <Link className="font-semibold text-brand-700 underline" href={`/achats-groupes/${g.slug}`}>
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs text-anthracite-500">Administrée par {c.createdBy.firstName}.</p>
      {user ? (
        <MembershipButton communityId={c.id} member={!!c.membership} isPublic={c.isPublic} inviteCode={c.membership ? c.inviteCode : null} />
      ) : (
        <Link href={`/connexion?suite=/communautes/${c.slug}`} className="block rounded-xl bg-brand-600 py-3 text-center font-semibold text-white">
          Se connecter pour rejoindre
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-[var(--radius-card)] p-3 ${highlight ? "capsule-lagune" : "bg-white shadow-[var(--shadow-card)]"}`}>
      <p className={`text-xs ${highlight ? "text-white" : "text-anthracite-600"}`}>{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular">{value}</p>
    </div>
  );
}
