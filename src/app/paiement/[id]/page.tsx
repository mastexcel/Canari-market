import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getPaymentForUser } from "@/application/payment.service";
import { DomainError } from "@/domain/errors";
import { formatFcfa } from "@/domain/money";
import { BrandMark } from "@/ui/Logo";
import { MockPayActions } from "./MockPayActions";

export const metadata = { title: "Paiement" };

const OP: Record<string, string> = { ORANGE_MONEY: "Orange Money", MTN_MOMO: "MTN MoMo", MOOV_MONEY: "Moov Money", WAVE: "Wave" };

/**
 * Page du prestataire SIMULÉ. En production, l'utilisateur est redirigé vers la
 * page hébergée du prestataire réel ; ici on reproduit le même aller-retour
 * (webhook signé) pour tester le parcours de bout en bout.
 */
export default async function MockPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/paiement/${id}`);
  let p;
  try {
    p = await getPaymentForUser(user.id, id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  if (p.status === "PAID") redirect(`/commandes/${p.order.id}?confirmee=1`);
  return (
    <main id="contenu" className="mx-auto grid min-h-dvh max-w-md place-items-center p-4">
      <div className="w-full rounded-3xl bg-white p-6 shadow-[var(--shadow-float)]">
        <div className="mb-4 flex items-center justify-between">
          <BrandMark size={40} />
          <span className="rounded-full bg-accent-100 px-3 py-1 text-xs font-bold text-accent-700">Prestataire de test</span>
        </div>
        <p className="text-sm text-anthracite-600">Commande {p.order.number}</p>
        <p className="mt-1 text-3xl font-extrabold tabular">{formatFcfa(p.amount)}</p>
        <p className="mt-2 text-sm text-anthracite-700">
          {p.method === "MOBILE_MONEY" ? `${OP[p.operator ?? ""] ?? "Mobile Money"} · ${p.payerPhoneMasked ?? ""}` : "Carte bancaire (saisie chez le prestataire)"}
        </p>
        {p.status === "FAILED" && <p className="mt-3 rounded-xl bg-alerte-100 p-3 text-sm text-alerte-700">Paiement échoué : {p.failureReason}. Vous pouvez réessayer depuis votre commande.</p>}
        {p.status === "PENDING" && (
          <>
            <p className="mt-4 rounded-xl bg-gris-100 p-3 text-sm text-anthracite-700">
              En production, vous validez ici le paiement sur votre téléphone (code secret Mobile Money). Choisissez le résultat à simuler :
            </p>
            <MockPayActions paymentId={p.id} orderId={p.order.id} />
          </>
        )}
      </div>
    </main>
  );
}
