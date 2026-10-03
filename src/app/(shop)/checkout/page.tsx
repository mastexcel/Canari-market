import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { getCart } from "@/application/cart.service";
import { creditBalance } from "@/application/credit.service";
import { COMMUNES } from "@/application/schemas";
import { describeFailurePolicy } from "@/domain/group-buy";
import { PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { CheckoutFlow } from "./CheckoutFlow";

export const metadata = { title: "Commande" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCart(user.id);
  if (!cart.lines.length) redirect("/panier");
  const gbIds = [...new Set(cart.lines.map((l) => l.groupBuyId).filter((x): x is string => !!x))];
  const [points, addresses, credit, gbs, zones, memberships] = await Promise.all([
    prisma.pickupPoint.findMany({ where: { isActive: true }, orderBy: [{ commune: "asc" }, { name: "asc" }] }),
    prisma.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } }),
    creditBalance(user.id),
    prisma.groupBuy.findMany({ where: { id: { in: gbIds } }, select: { title: true, failurePolicy: true, extensionDays: true, maxExtensions: true } }),
    prisma.deliveryZone.findMany({ where: { isActive: true }, select: { commune: true } }),
    prisma.communityMember.findMany({ where: { userId: user.id }, include: { community: { select: { pickupPointId: true } } } }),
  ]);
  const preferredPoint = memberships.find((m) => m.community.pickupPointId)?.community.pickupPointId ?? points.find((p) => p.commune === user.commune)?.id ?? points[0]?.id;
  return (
    <div>
      <PageHeader title="Commande" back={<BackLink href="/panier" />} />
      <CheckoutFlow
        points={points.map((p) => ({ id: p.id, name: p.name, commune: p.commune, quartier: p.quartier, hours: p.openingHours, fee: p.customerFee, landmark: p.landmark }))}
        addresses={addresses.map((a) => ({ id: a.id, label: a.label, commune: a.commune, quartier: a.quartier, landmark: a.landmark }))}
        deliverableCommunes={zones.map((z) => z.commune)}
        communes={[...COMMUNES]}
        defaultCommune={user.commune ?? "Cocody"}
        preferredPointId={preferredPoint ?? null}
        credit={credit}
        policies={gbs.map((g) => ({ title: g.title, policy: g.failurePolicy, text: describeFailurePolicy(g.failurePolicy, g) }))}
        defaultPhone={user.phone.replace(/^\+225/, "")}
      />
    </div>
  );
}
