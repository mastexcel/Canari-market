import { requireRole } from "@/lib/session";
import { pickupDashboard } from "@/application/delivery.service";
import { formatFcfa } from "@/domain/money";
import { formatDateTime } from "@/domain/dates";
import { H1, StatCard, Table } from "@/ui/pro/ProShell";
import { PickupDesk } from "./PickupDesk";

export default async function PickupHome() {
  const user = await requireRole(["PICKUP_POINT"]);
  const d = await pickupDashboard(user.id);
  return (
    <div className="space-y-5">
      <H1>{d.point.name}</H1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="En route vers vous" value={String(d.incoming.length)} />
        <StatCard tone="brand" label="À remettre" value={String(d.waiting.length)} />
        <StatCard tone="economie" label="Rémunération du mois" value={formatFcfa(d.earnings.thisMonth)} hint={`${d.earnings.monthParcels} colis × ${formatFcfa(d.point.feePerParcel)}`} />
        <StatCard label="Total perçu" value={formatFcfa(d.earnings.total)} hint={`${d.earnings.parcels} colis remis`} />
      </div>
      <PickupDesk incoming={d.incoming.map((x) => ({ number: x.order.number, name: x.order.user.firstName, id: x.id }))} />
      <section>
        <h2 className="mb-2 text-lg font-bold">Colis en attente de retrait</h2>
        <Table head={["Commande", "Client", "Arrivé le", "Contenu"]} empty={d.waiting.length === 0}>
          {d.waiting.map((w) => (
            <tr key={w.id}>
              <td className="px-3 py-2 font-semibold">{w.order.number}</td>
              <td className="px-3 py-2">
                {w.order.user.firstName} {w.order.user.lastName?.[0] ?? ""}.
              </td>
              <td className="px-3 py-2">{w.arrivedAt ? formatDateTime(w.arrivedAt) : "—"}</td>
              <td className="px-3 py-2 text-xs">{w.order.items.map((i) => `${i.quantity}× ${i.label}`).join(", ")}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
