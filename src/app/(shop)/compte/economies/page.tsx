import { requireUser } from "@/lib/session";
import { userSavings } from "@/application/savings.service";
import { formatFcfa } from "@/domain/money";
import { Card, PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { EmptyState } from "@/ui/EmptyState";
import { ButtonLink } from "@/ui/Button";

export const metadata = { title: "Mes économies" };

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function SavingsPage() {
  const user = await requireUser("/compte/economies");
  const s = await userSavings(user.id);
  const max = Math.max(1, ...s.byMonth.map((m) => m.amount));
  return (
    <div className="space-y-4">
      <PageHeader title="Mes économies" back={<BackLink href="/compte" />} />
      <section className="rounded-[var(--radius-card)] bg-economie-600 p-5 text-white">
        <p className="text-sm text-white/85">Vous avez économisé</p>
        <dl className="mt-3 space-y-2">
          {s.lastOrder && (
            <div className="flex justify-between">
              <dt>Dernière commande</dt>
              <dd className="font-bold tabular">{formatFcfa(s.lastOrder.savingsTotal)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Ce mois</dt>
            <dd className="font-bold tabular">{formatFcfa(s.thisMonth)}</dd>
          </div>
          <div className="flex justify-between border-t border-white/25 pt-2 text-xl">
            <dt className="font-semibold">Depuis votre inscription</dt>
            <dd className="font-black tabular">{formatFcfa(s.total)}</dd>
          </div>
        </dl>
      </section>
      {s.total === 0 ? (
        <EmptyState title="Vos économies apparaîtront ici" emoji="🌱" action={<ButtonLink href="/achats-groupes">Rejoindre un achat groupé</ButtonLink>} />
      ) : (
        <Card className="p-4">
          <h2 className="mb-4 font-bold">6 derniers mois</h2>
          <ul className="flex h-40 items-end gap-2" aria-label="Économies par mois">
            {s.byMonth.map((m) => {
              const [, mm] = m.month.split("-");
              return (
                <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-semibold tabular text-anthracite-700">{m.amount ? `${Math.round(m.amount / 100) / 10}k` : ""}</span>
                  <span className="w-full rounded-t-md bg-economie-600" style={{ height: `${Math.max(2, (m.amount / max) * 100)}%` }} title={`${formatFcfa(m.amount)}`} />
                  <span className="text-[11px] text-anthracite-600">{MONTHS[Number(mm) - 1]}</span>
                  <span className="sr-only">{formatFcfa(m.amount)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <p className="text-xs text-anthracite-600">
        Méthode : pour chaque article payé, prix de référence marché (relevé daté de moins de 30 jours) moins le prix CANARI final, frais de fractionnement inclus. Les frais de livraison ne sont pas déduits. Les commandes annulées ou remboursées ne comptent pas.
      </p>
    </div>
  );
}
