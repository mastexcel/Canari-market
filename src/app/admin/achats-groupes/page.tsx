import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { computeProgress } from "@/domain/group-buy";
import { toGroupBuyState } from "@/application/pricing.service";
import { formatUnits } from "@/domain/units";
import { formatShortDate } from "@/domain/dates";
import { Badge } from "@/ui/Badge";
import { ButtonLink } from "@/ui/Button";
import { H1, Table } from "@/ui/pro/ProShell";
import { GB_STATUS } from "@/ui/pro/labels";

export const metadata = { title: "Achats groupés" };


export default async function AdminGroupBuys() {
  await requirePermission("GROUPBUYS_MANAGE");
  const gbs = await prisma.groupBuy.findMany({ include: { tiers: true, product: { select: { emoji: true } } }, orderBy: [{ status: "asc" }, { closesAt: "desc" }] });
  return (
    <div>
      <H1 action={<ButtonLink href="/admin/achats-groupes/nouveau" size="sm">+ Nouvel achat groupé</ButtonLink>}>Achats groupés</H1>
      <Table head={["Achat", "Statut", "Progression", "Participants", "Clôture", ""]} empty={gbs.length === 0}>
        {gbs.map((g) => {
          const p = computeProgress(toGroupBuyState(g));
          return (
            <tr key={g.id}>
              <td className="px-3 py-2.5 font-semibold">
                {g.product.emoji} {g.title}
              </td>
              <td className="px-3 py-2.5">
                <Badge tone={GB_STATUS[g.status].tone}>{GB_STATUS[g.status].label}</Badge>
              </td>
              <td className="px-3 py-2.5 tabular">
                {formatUnits(p.committedUnits, 1)} / {g.targetUnits} ({Math.floor(p.percentOfTarget)} %)
              </td>
              <td className="px-3 py-2.5 tabular">{g.participantCount}</td>
              <td className="px-3 py-2.5">{formatShortDate(g.closesAt)}</td>
              <td className="px-3 py-2.5 text-right">
                <Link href={`/admin/achats-groupes/${g.id}`} className="font-semibold text-bordeaux-700 underline">
                  Piloter
                </Link>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
