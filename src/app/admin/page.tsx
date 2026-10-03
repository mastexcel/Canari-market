import Link from "next/link";
import { requireUser } from "@/lib/session";
import { hasPermission } from "@/domain/permissions";
import { dashboardKpis, dailySeries } from "@/application/admin.service";
import { listOpenGroupBuys } from "@/application/group-buy.service";
import { prisma } from "@/infrastructure/db";
import { formatFcfa } from "@/domain/money";
import { formatUnits } from "@/domain/units";
import { timeLeft } from "@/domain/dates";
import { Alert } from "@/ui/Alert";
import { GroupProgress } from "@/ui/ProgressBar";
import { BarChart } from "@/ui/pro/BarChart";
import { H1, StatCard } from "@/ui/pro/ProShell";

const pct = (r: number | null) => (r === null ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(r * 100)} %`);

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ refus?: string }> }) {
  const user = await requireUser("/admin");
  const { refus } = await searchParams;
  if (!hasPermission(user, "ANALYTICS_VIEW")) {
    return (
      <div>
        <H1>Bienvenue {user.firstName}</H1>
        <Alert tone="info">Votre profil n&apos;inclut pas les statistiques. Utilisez le menu pour accéder à vos modules.</Alert>
      </div>
    );
  }
  const [k, series, gbs, pendingRefunds, tickets] = await Promise.all([
    dashboardKpis(30),
    dailySeries(30),
    listOpenGroupBuys(),
    prisma.refund.count({ where: { status: { in: ["PENDING", "FAILED"] } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  const dayLabel = (d: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(d));
  return (
    <div className="space-y-6">
      <H1>Tableau de bord <span className="text-base font-semibold text-anthracite-500">· 30 derniers jours</span></H1>
      {refus && <Alert tone="warning">Vous n&apos;avez pas la permission d&apos;accéder à cette page.</Alert>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard tone="economie" label="Économie réelle générée (KPI n°1)" value={formatFcfa(k.savings)} hint={`${formatFcfa(k.savingsPerHousehold)} par ménage actif`} />
        <StatCard tone="bordeaux" label="GMV" value={formatFcfa(k.gmv)} hint={`CA net de remboursements : ${formatFcfa(k.revenue)}`} />
        <StatCard label="Marge brute" value={formatFcfa(k.grossMargin)} hint={`${pct(k.grossMarginRate)} des ventes produits${k.uncostedRevenue ? " (hors ventes sans coût connu)" : ""}`} />
        <StatCard label="Commandes" value={String(k.orders)} hint={`Panier moyen ${formatFcfa(k.averageBasket)}`} />
        <StatCard label="Ménages actifs" value={String(k.activeUsers)} hint={`${k.newUsers} nouveaux inscrits`} />
        <StatCard label="Taux de réachat" value={pct(k.repeatRate)} hint="Acheteurs avec 2 commandes ou plus" />
        <StatCard label="Coût logistique / commande" value={formatFcfa(k.logisticsCostPerOrder)} hint={`Livraisons réussies : ${pct(k.deliverySuccessRate)}`} />
        <StatCard label="Achats groupés actifs" value={String(k.activeGroupBuys)} hint={`Taux d'atteinte des seuils : ${pct(k.groupBuySuccessRate)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <BarChart label="Économies générées par jour" color="var(--color-economie-600)" data={series.map((s) => ({ key: s.date, label: dayLabel(s.date), value: s.savings }))} />
        <BarChart label="GMV par jour" data={series.map((s) => ({ key: s.date, label: dayLabel(s.date), value: s.gmv }))} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 font-bold">Achats groupés en cours</h2>
          <ul className="space-y-3">
            {gbs.map((g) => (
              <li key={g.id}>
                <Link href={`/admin/achats-groupes/${g.id}`} className="block">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{g.title}</span>
                    <span className="tabular text-anthracite-600">
                      {formatUnits(g.progress.committedUnits, 0)}/{g.targetUnits} · {timeLeft(g.closesAt, new Date())}
                    </span>
                  </div>
                  <GroupProgress percent={g.progress.percentOfTarget} size="sm" label={g.title} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-2 font-bold">Produits les plus vendus</h2>
            <ol className="space-y-1 text-sm">
              {k.topProducts.map((p, i) => (
                <li key={p.name} className="flex justify-between">
                  <span>
                    {i + 1}. {p.emoji} {p.name}
                  </span>
                  <span className="tabular text-anthracite-600">{formatFcfa(p.revenue)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Volume fournisseurs (BC)" value={formatFcfa(k.supplierVolume)} />
            <StatCard label="Ménages / communauté" value={String(k.householdsPerCommunity)} hint={`${k.communities} communautés`} />
            <StatCard tone={pendingRefunds ? "alerte" : undefined} label="Remboursements à traiter" value={String(pendingRefunds)} />
            <StatCard label="Tickets support ouverts" value={String(tickets)} />
          </div>
        </div>
      </section>
    </div>
  );
}
