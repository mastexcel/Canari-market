import { requirePermission } from "@/lib/session";
import { dashboardKpis, dailySeries } from "@/application/admin.service";
import { prisma } from "@/infrastructure/db";
import { formatFcfa } from "@/domain/money";
import { BarChart } from "@/ui/pro/BarChart";
import { H1, StatCard, Table } from "@/ui/pro/ProShell";

export const metadata = { title: "Analytics" };

const STEP: Record<string, string> = {
  group_buy_viewed: "A vu un achat groupé",
  group_buy_joined: "A rejoint (payé)",
  checkout_started: "A commencé une commande",
  payment_completed: "A payé",
  order_delivered: "A été livré",
};

export default async function Analytics({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requirePermission("ANALYTICS_VIEW");
  const days = Math.min(365, Math.max(7, Number((await searchParams).jours) || 90));
  const [k, series, events] = await Promise.all([
    dashboardKpis(days),
    dailySeries(Math.min(days, 90)),
    prisma.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: new Date(Date.now() - days * 86_400_000) } }, _count: { _all: true }, orderBy: { name: "asc" } }),
  ]);
  const maxFunnel = Math.max(1, ...k.funnel.map((f) => f.users));
  return (
    <div className="space-y-6">
      <H1
        action={
          <form className="flex gap-2 text-sm">
            <select name="jours" defaultValue={String(days)} className="h-9 rounded-lg border border-gris-300 bg-white px-2">
              {[7, 30, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} jours
                </option>
              ))}
            </select>
            <button className="h-9 rounded-lg bg-bordeaux-600 px-3 font-semibold text-white">OK</button>
          </form>
        }
      >
        Analytics
      </H1>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard tone="economie" label="Économie réelle générée" value={formatFcfa(k.savings)} />
        <StatCard label="Économie moyenne / ménage" value={formatFcfa(k.savingsPerHousehold)} />
        <StatCard label="GMV" value={formatFcfa(k.gmv)} />
        <StatCard label="Volume consolidé (achats groupés)" value={`${Math.round(k.consolidatedBase / 1000).toLocaleString("fr-FR")} kg/L/u`} />
        <StatCard label="Taux de réachat" value={`${Math.round(k.repeatRate * 100)} %`} />
      </div>
      <section className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 font-bold">Funnel (utilisateurs distincts)</h2>
        <ol className="space-y-2">
          {k.funnel.map((f) => (
            <li key={f.step}>
              <div className="flex justify-between text-sm">
                <span>{STEP[f.step]}</span>
                <span className="tabular">
                  {f.users} <span className="text-anthracite-500">({Math.round(f.conversionFromPrevious * 100)} % de l&apos;étape précédente)</span>
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-gris-100">
                <div className="h-3 rounded-full bg-bordeaux-600" style={{ width: `${(f.users / maxFunnel) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarChart label="Commandes payées par jour" kind="count" data={series.map((s) => ({ key: s.date, label: s.date.slice(5), value: s.orders }))} />
        <BarChart label="Économies par jour" color="var(--color-economie-600)" data={series.map((s) => ({ key: s.date, label: s.date.slice(5), value: s.savings }))} />
      </div>
      <Table head={["Événement", "Occurrences"]}>
        {events.map((e) => (
          <tr key={e.name}>
            <td className="px-3 py-2 font-mono text-xs">{e.name}</td>
            <td className="px-3 py-2 tabular">{e._count._all}</td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-anthracite-500">Les événements ne contiennent aucune donnée personnelle (identifiants techniques et montants uniquement). Toute analyse partagée hors de CANARI est agrégée et anonymisée.</p>
    </div>
  );
}
