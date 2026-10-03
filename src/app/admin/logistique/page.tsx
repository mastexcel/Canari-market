import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { logisticsBoard } from "@/application/delivery.service";
import { formatDateTime } from "@/domain/dates";
import { CommandButton } from "@/ui/pro/Command";
import { H1, StatCard, Table } from "@/ui/pro/ProShell";
import { AssignDriver } from "./AssignDriver";

export const metadata = { title: "Logistique" };

export default async function Logistics() {
  await requirePermission("LOGISTICS_MANAGE");
  const b = await logisticsBoard();
  const pickupReady = b.ready.filter((o) => o.fulfillmentMode === "PICKUP");
  const homeReady = b.ready.filter((o) => o.fulfillmentMode === "HOME_DELIVERY");
  return (
    <div className="space-y-6">
      <H1>Logistique</H1>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Stock à préparer" value={String(b.toPrepare.length)} />
        <StatCard label="Prêtes — point relais" value={String(pickupReady.length)} />
        <StatCard label="Prêtes — domicile" value={String(homeReady.length)} />
        <StatCard label="En cours" value={String(b.inProgress.length)} />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Commandes en stock à préparer</h2>
        <Table head={["Commande", "Créée", ""]} empty={b.toPrepare.length === 0}>
          {b.toPrepare.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2">
                <Link className="font-semibold underline" href={`/admin/commandes/${o.id}`}>{o.number}</Link>
              </td>
              <td className="px-3 py-2">{formatDateTime(o.createdAt)}</td>
              <td className="px-3 py-2 text-right">
                <CommandButton space="admin" body={{ type: "order.prepare", orderId: o.id }} success="Préparée">Marquer préparée</CommandButton>
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Prêtes pour les points relais</h2>
          {pickupReady.length > 0 && (
            <CommandButton space="admin" body={{ type: "logistics.dispatchPickup", orderIds: pickupReady.map((o) => o.id) }} success="Tournée expédiée" confirm={`Expédier ${pickupReady.length} colis vers leurs points relais ?`}>
              Expédier la tournée ({pickupReady.length})
            </CommandButton>
          )}
        </div>
        <Table head={["Commande", "Client", "Point relais"]} empty={pickupReady.length === 0}>
          {pickupReady.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2 font-semibold">{o.number}</td>
              <td className="px-3 py-2">{o.user.firstName}</td>
              <td className="px-3 py-2">{o.pickupPoint?.name}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Prêtes pour la livraison à domicile</h2>
        <Table head={["Commande", "Adresse", "Créneau", "Livreur"]} empty={homeReady.length === 0}>
          {homeReady.map((o) => (
            <tr key={o.id}>
              <td className="px-3 py-2 font-semibold">{o.number}</td>
              <td className="px-3 py-2">
                {o.address?.quartier}, {o.address?.commune}
                {o.delivery?.failureReason && <span className="block text-xs text-alerte-700">Incident : {o.delivery.failureReason}</span>}
              </td>
              <td className="px-3 py-2">{o.slotStart ? formatDateTime(o.slotStart) : "—"}</td>
              <td className="px-3 py-2">
                <AssignDriver orderId={o.id} drivers={b.drivers.map((d) => ({ id: d.id, label: `${d.user.firstName} ${d.user.lastName ?? ""} (${d.vehicleType})` }))} />
              </td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">En cours</h2>
        <Table head={["Commande", "Mode", "Statut", "Livreur / point"]} empty={b.inProgress.length === 0}>
          {b.inProgress.map((d) => (
            <tr key={d.id}>
              <td className="px-3 py-2 font-semibold">{d.order.number}</td>
              <td className="px-3 py-2">{d.mode === "PICKUP" ? "Point relais" : "Domicile"}</td>
              <td className="px-3 py-2">{d.status}</td>
              <td className="px-3 py-2">{d.driver?.user.firstName ?? d.pickupPoint?.name ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </section>
    </div>
  );
}
