import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getBasket } from "@/application/catalog.service";
import { DomainError } from "@/domain/errors";
import { formatBps, formatFcfa } from "@/domain/money";
import { formatShortDate } from "@/domain/dates";
import { Card, PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { Alert } from "@/ui/Alert";
import { AddBasket } from "./AddBasket";

export default async function BasketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  let b;
  try {
    b = await getBasket(slug);
  } catch (e) {
    if (e instanceof DomainError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <div className="space-y-4">
      <PageHeader title={b.name} subtitle={b.householdHint} back={<BackLink href="/" />} />
      <p className="text-sm text-anthracite-700">{b.description}</p>
      <Card className="p-4">
        <dl className="space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-anthracite-600">Valeur estimée au détail</dt>
            <dd className="tabular line-through">{formatFcfa(b.referenceTotal)}</dd>
          </div>
          <div className="flex justify-between text-lg">
            <dt className="font-bold">Prix CANARI</dt>
            <dd className="tabular font-extrabold text-bordeaux-700">{formatFcfa(b.canariTotal)}</dd>
          </div>
          <div className="flex justify-between font-bold text-economie-700">
            <dt>Économie</dt>
            <dd className="tabular">
              {formatFcfa(b.saving)} · {formatBps(b.savingBps)}
            </dd>
          </div>
        </dl>
        {b.oldestReference && <p className="mt-2 text-xs text-anthracite-500">Prix de référence : relevés CANARI sur les marchés d&apos;Abidjan, le plus ancien du {formatShortDate(b.oldestReference)}.</p>}
        {!b.referenceComplete && (
          <Alert tone="warning" className="mt-2">
            Certains relevés sont anciens : leur économie n&apos;est pas comptée.
          </Alert>
        )}
      </Card>
      <Card className="divide-y divide-gris-200">
        {b.items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {it.variant.product.emoji}
              </span>
              <span>
                <span className="block font-semibold">{it.variant.product.name}</span>
                <span className="text-anthracite-600">
                  {it.quantity} × {it.variant.name}
                </span>
              </span>
            </span>
            <span className="tabular font-semibold">{formatFcfa(it.unitPrice * it.quantity)}</span>
          </div>
        ))}
      </Card>
      <AddBasket slug={b.slug} loggedIn={!!user} />
      <p className="text-center text-xs text-anthracite-600">Le panier est ajouté ligne par ligne : vous pourrez ensuite modifier chaque quantité.</p>
    </div>
  );
}
