import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { driverMissions } from "@/application/delivery.service";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { formatPhone } from "@/domain/phone";
import { H1 } from "@/ui/pro/ProShell";
import { MissionActions } from "./MissionActions";

export default async function Mission({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["DRIVER"]);
  const { id } = await params;
  const m = await driverMissions(user.id);
  const d = m.active.find((x) => x.id === id);
  if (!d) notFound();
  const a = d.order.address;
  const mapQuery = encodeURIComponent(`${a?.quartier ?? ""}, ${a?.commune ?? ""}, Abidjan, Côte d'Ivoire`);
  return (
    <div className="space-y-4">
      <H1>Mission {d.order.number}</H1>
      <div className="space-y-1 rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        <p className="font-bold">Client : {d.order.user.firstName}</p>
        <p>
          <a className="font-semibold text-bordeaux-700 underline" href={`tel:${d.order.user.phone}`}>
            📞 {formatPhone(d.order.user.phone)}
          </a>
        </p>
        <p>
          📍 {a?.quartier}, {a?.commune}
          {a?.landmark ? ` — ${a.landmark}` : ""}
        </p>
        {d.scheduledStart && <p>🕘 Créneau : {formatDateTime(d.scheduledStart)}</p>}
        <p>
          ⚖️ {Math.ceil(d.weightGrams / 1000)} kg · gain {formatFcfa(d.driverFee)}
        </p>
        <a className="mt-2 inline-block rounded-lg bg-info-100 px-3 py-2 font-semibold text-info-700" href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">
          🗺️ Itinéraire
        </a>
      </div>
      <div className="rounded-[var(--radius-card)] bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        <p className="mb-1 font-bold">Colis</p>
        <ul>
          {d.order.items.map((i, k) => (
            <li key={k}>
              {i.quantity} × {i.label}
            </li>
          ))}
        </ul>
      </div>
      <MissionActions deliveryId={d.id} status={d.status} />
    </div>
  );
}
