import { requireUser } from "@/lib/session";
import { getCart } from "@/application/cart.service";
import { formatFcfa } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import { PageHeader, Card } from "@/ui/Card";
import { EmptyState } from "@/ui/EmptyState";
import { ButtonLink } from "@/ui/Button";
import { Alert } from "@/ui/Alert";
import { CartLineControls } from "./CartLineControls";
import Link from "next/link";

export const metadata = { title: "Panier" };

export default async function CartPage() {
  const user = await requireUser("/panier");
  const cart = await getCart(user.id);
  if (!cart.lines.length) {
    return (
      <div>
        <PageHeader title="Panier" />
        <EmptyState title="Votre panier est vide" emoji="🧺" action={<ButtonLink href="/achats-groupes">Voir les achats groupés</ButtonLink>}>
          Rejoignez un achat groupé ou choisissez un panier famille.
        </EmptyState>
      </div>
    );
  }
  const latest = cart.lines.filter((l) => l.expectedDeliveryAt).map((l) => l.expectedDeliveryAt!.getTime());
  return (
    <div className="space-y-4">
      <PageHeader title="Panier" subtitle={`${cart.count} article${cart.count > 1 ? "s" : ""}`} />
      <Card className="divide-y divide-gris-200">
        {cart.lines.map((l) => (
          <div key={l.id} className="p-3">
            <div className="flex gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gris-100 text-2xl" aria-hidden>
                {l.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={l.href} className="font-semibold leading-snug">
                  {l.label}
                </Link>
                <p className="text-xs text-anthracite-600">{l.sublabel}</p>
                {l.price && (
                  <p className="mt-0.5 text-sm">
                    <span className="tabular font-bold text-brand-700">{formatFcfa(l.price.unitPrice + l.price.fractionationFee)}</span>
                    {l.price.referenceIsUsable && l.price.referenceUnitPrice > l.price.unitPrice + l.price.fractionationFee && (
                      <span className="ml-1.5 text-xs text-anthracite-500 line-through">{formatFcfa(l.price.referenceUnitPrice)}</span>
                    )}
                  </p>
                )}
                {l.kind === "GROUP_BUY" && l.percent !== undefined && <p className="text-xs text-anthracite-600">Groupe à {Math.floor(l.percent)} % · clôture le {formatDate(l.closesAt!)}</p>}
              </div>
            </div>
            {l.issue && (
              <Alert tone="error" className="mt-2">
                {l.issue}
              </Alert>
            )}
            <CartLineControls id={l.id} quantity={l.quantity} total={l.lineTotal} />
          </div>
        ))}
      </Card>
      <Card className="space-y-1.5 p-4">
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span className="tabular font-bold">{formatFcfa(cart.subtotal)}</span>
        </div>
        {cart.savings > 0 && (
          <div className="flex justify-between font-semibold text-economie-700">
            <span>Économie Sesam-Market</span>
            <span className="tabular">−{formatFcfa(cart.savings)}</span>
          </div>
        )}
        <p className="text-xs text-anthracite-600">Livraison calculée à l&apos;étape suivante.</p>
        {latest.length > 0 && <p className="text-xs text-anthracite-600">Votre commande sera préparée quand tous vos achats groupés seront clôturés (livraison prévue vers le {formatDate(new Date(Math.max(...latest)))}).</p>}
      </Card>
      {cart.hasIssues ? (
        <Alert tone="warning">Retirez les lignes indisponibles pour continuer.</Alert>
      ) : (
        <ButtonLink href="/checkout" block size="lg">
          Passer commande
        </ButtonLink>
      )}
    </div>
  );
}
