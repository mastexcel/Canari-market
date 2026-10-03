import Link from "next/link";
import { requireRole } from "@/lib/session";
import { driverMissions } from "@/application/delivery.service";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { EmptyState } from "@/ui/EmptyState";
import { H1, StatCard } from "@/ui/pro/ProShell";

const S: Record<string, string> = { ASSIGNED: "Nouvelle mission", ACCEPTED: "Acceptée", PICKED_UP: "En livraison" };

export default async function DriverHome() {
  const user = await requireRole(["DRIVER"]);
  const m = await driverMissions(user.id);
  return (
    <div className="space-y-4">
      <H1>Mes missions</H1>
      <div className="grid grid-cols-3 gap-2">
        <StatCard tone="economie" label="Gains du mois" value={formatFcfa(m.earnings.thisMonth)} />
        <StatCard label="Total" value={formatFcfa(m.earnings.total)} />
        <StatCard label="Livraisons" value={String(m.earnings.deliveries)} />
      </div>
      {m.active.length === 0 ? (
        <EmptyState title="Aucune mission en cours" emoji="🛵">Les nouvelles missions apparaissent ici et vous sont notifiées.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {m.active.map((d) => (
            <li key={d.id}>
              <Link href={`/livreur/missions/${d.id}`} className="block rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
                <div className="flex justify-between gap-2">
                  <p className="font-bold">{d.order.number}</p>
                  <Badge tone={d.status === "ASSIGNED" ? "accent" : "brand"}>{S[d.status]}</Badge>
                </div>
                <p className="mt-1 text-sm">
                  📍 {d.order.address?.quartier}, {d.order.address?.commune}
                </p>
                <p className="text-sm text-anthracite-600">
                  {d.scheduledStart ? `🕘 ${formatDateTime(d.scheduledStart)} · ` : ""}
                  {Math.ceil(d.weightGrams / 1000)} kg · gain {formatFcfa(d.driverFee)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
