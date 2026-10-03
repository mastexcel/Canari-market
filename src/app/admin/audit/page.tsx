import { requirePermission } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { formatDateTime } from "@/domain/dates";
import { H1, Table } from "@/ui/pro/ProShell";

export const metadata = { title: "Journal d'audit" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requirePermission("AUDIT_VIEW");
  const { action } = await searchParams;
  const logs = await prisma.auditLog.findMany({
    where: action ? { action: { startsWith: action.slice(0, 40) } } : {},
    include: { actor: { select: { firstName: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <H1>Journal d&apos;audit</H1>
      <form className="mb-4 flex gap-2">
        <input name="action" defaultValue={action} placeholder="Filtrer : price, groupbuy, refund…" className="h-10 rounded-lg border border-gris-300 bg-white px-3 text-sm" />
        <button className="h-10 rounded-lg bg-bordeaux-600 px-4 text-sm font-semibold text-white">Filtrer</button>
      </form>
      <Table head={["Date", "Acteur", "Action", "Objet", "Détail"]} empty={logs.length === 0}>
        {logs.map((l) => (
          <tr key={l.id}>
            <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
            <td className="px-3 py-2">{l.actor ? `${l.actor.firstName} (${l.actor.role})` : "Système"}</td>
            <td className="px-3 py-2 font-mono text-xs">{l.action}</td>
            <td className="px-3 py-2 text-xs">
              {l.entityType} {l.entityId.slice(-6)}
            </td>
            <td className="max-w-md truncate px-3 py-2 font-mono text-[11px] text-anthracite-600">{l.after ? JSON.stringify(l.after).slice(0, 160) : ""}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
