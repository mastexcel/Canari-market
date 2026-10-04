import { prisma } from "@/infrastructure/db";
import { formatFcfa } from "@/domain/money";
import { PageHeader } from "@/ui/Card";

export const metadata = { title: "Points relais" };

export default async function PickupPointsPage() {
  const points = await prisma.pickupPoint.findMany({ where: { isActive: true }, orderBy: [{ commune: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Points Sesam" subtitle="Retirez vos commandes près de chez vous avec un code : c'est le mode le plus économique." />
      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p.id} className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
            <p className="font-bold">{p.name}</p>
            <p className="text-sm text-anthracite-700">
              {p.address}, {p.quartier}, {p.commune}
            </p>
            {p.landmark && <p className="text-xs text-anthracite-600">Repère : {p.landmark}</p>}
            <p className="mt-1 text-xs text-anthracite-600">
              🕘 {p.openingHours} · Retrait {p.customerFee ? formatFcfa(p.customerFee) : "gratuit"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
