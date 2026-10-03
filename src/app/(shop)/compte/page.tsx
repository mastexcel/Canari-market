import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/infrastructure/db";
import { userSavings } from "@/application/savings.service";
import { creditBalance } from "@/application/credit.service";
import { formatFcfa } from "@/domain/money";
import { formatPhone } from "@/domain/phone";
import { Card } from "@/ui/Card";
import { LogoutButton } from "./LogoutButton";

export const metadata = { title: "Mon compte" };

export default async function AccountPage() {
  const user = await requireUser("/compte");
  const [savings, credit, household] = await Promise.all([userSavings(user.id), creditBalance(user.id), prisma.household.findUnique({ where: { userId: user.id } })]);
  const links = [
    { href: "/compte/economies", emoji: "💰", label: "Mes économies", hint: formatFcfa(savings.total) },
    { href: "/compte/parrainage", emoji: "🎁", label: "Parrainage", hint: "Invitez vos proches" },
    { href: "/communautes", emoji: "👥", label: "Mes communautés" },
    { href: "/notifications", emoji: "🔔", label: "Notifications" },
    { href: "/points-relais", emoji: "📍", label: "Points relais" },
    { href: "/support", emoji: "💬", label: "Aide & support" },
    { href: "/compte/confidentialite", emoji: "🔒", label: "Confidentialité & données" },
  ];
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xl font-extrabold">
          {user.firstName} {user.lastName ?? ""}
        </p>
        <p className="text-sm text-anthracite-600">{formatPhone(user.phone)}</p>
        <p className="text-sm text-anthracite-600">
          {user.quartier}, {user.commune}
          {household && ` · ménage de ${household.adults + household.children} personnes`}
        </p>
        {credit > 0 && <p className="mt-2 rounded-xl bg-economie-50 p-2 text-sm font-semibold text-economie-700">Avoir disponible : {formatFcfa(credit)}</p>}
      </Card>
      <Card className="divide-y divide-gris-200">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 font-semibold">
              <span aria-hidden>{l.emoji}</span>
              {l.label}
            </span>
            <span className="text-sm text-anthracite-600">{l.hint ?? "›"}</span>
          </Link>
        ))}
      </Card>
      <LogoutButton />
    </div>
  );
}
