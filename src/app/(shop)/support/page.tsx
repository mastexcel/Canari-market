import { requireUser } from "@/lib/session";
import { listTickets } from "@/application/support.service";
import { listOrders } from "@/application/order.service";
import { formatDateTime } from "@/domain/dates";
import { Card, PageHeader } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { SupportForm } from "./SupportForm";

export const metadata = { title: "Aide & support" };

const FAQ = [
  ["Que se passe-t-il si l'achat groupé n'atteint pas son seuil ?", "La règle est affichée avant le paiement : prolongation, remboursement intégral, prix alternatif (avec votre accord) ou avoir (seulement si vous l'avez choisi)."],
  ["Le prix peut-il augmenter après mon paiement ?", "Non. Vous payez le prix actuel ; s'il baisse grâce au groupe, la différence vous est remboursée."],
  ["Comment retirer ma commande ?", "Présentez votre code à 6 chiffres (ou le QR code) au point relais. Ne le communiquez qu'au moment de la remise."],
  ["Mes données de paiement sont-elles stockées ?", "Non. Le paiement est géré par un prestataire agréé ; Sesam-Market ne voit jamais votre code secret ni votre carte."],
];

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ commande?: string }> }) {
  const { commande } = await searchParams;
  const user = await requireUser("/support");
  const [tickets, orders] = await Promise.all([listTickets(user.id), listOrders(user.id)]);
  return (
    <div className="space-y-4">
      <PageHeader title="Aide & support" />
      <Card className="divide-y divide-gris-200">
        {FAQ.map(([q, a]) => (
          <details key={q} className="p-4">
            <summary className="cursor-pointer font-semibold">{q}</summary>
            <p className="mt-2 text-sm text-anthracite-700">{a}</p>
          </details>
        ))}
      </Card>
      <SupportForm orders={orders.slice(0, 20).map((o) => ({ id: o.id, number: o.number }))} defaultOrderId={commande} />
      {tickets.length > 0 && (
        <section>
          <h2 className="mb-2 font-bold">Mes demandes</h2>
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-[var(--radius-card)] bg-white p-3 shadow-[var(--shadow-card)]">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{t.subject}</p>
                  <Badge tone={t.status === "RESOLVED" || t.status === "CLOSED" ? "economie" : "accent"}>{t.status === "OPEN" ? "Ouverte" : t.status === "IN_PROGRESS" ? "En cours" : "Résolue"}</Badge>
                </div>
                <p className="text-xs text-anthracite-500">{formatDateTime(t.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
