"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, newIdempotencyKey } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { Input, Select, Textarea } from "@/ui/Field";
import { useToast } from "@/ui/Toast";
import { formatFcfa } from "@/domain/money";

function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();
  const run = async (key: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    } finally {
      setBusy(null);
    }
  };
  return { busy, run, router };
}

export function OrderActions({ orderId, canPay, canCancel }: { orderId: string; canPay: boolean; canCancel: boolean }) {
  const { busy, run, router } = useAction();
  const [confirm, setConfirm] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [operator, setOperator] = useState("ORANGE_MONEY");
  const [phone, setPhone] = useState("");
  const key = useRef(newIdempotencyKey());
  if (!canPay && !canCancel) return null;
  return (
    <div className="space-y-2">
      {canPay && (
        <>
          <Button block size="lg" onClick={() => setPayOpen(true)}>
            Payer maintenant
          </Button>
          <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Payer la commande">
            <div className="space-y-3">
              <Select label="Moyen de paiement" value={operator} onChange={(e) => setOperator(e.target.value)}>
                <option value="ORANGE_MONEY">Orange Money</option>
                <option value="MTN_MOMO">MTN MoMo</option>
                <option value="MOOV_MONEY">Moov Money</option>
                <option value="WAVE">Wave</option>
                <option value="CARD">Carte bancaire</option>
              </Select>
              {operator !== "CARD" && <Input label="Numéro Mobile Money" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" />}
              <Button
                block
                loading={busy === "pay"}
                onClick={() =>
                  run("pay", async () => {
                    const body = operator === "CARD" ? { orderId, method: "CARD", purpose: "ORDER" } : { orderId, method: "MOBILE_MONEY", operator, payerPhone: phone, purpose: "ORDER" };
                    const r = await api<{ redirectUrl: string }>("/payments", { body, idempotencyKey: key.current });
                    router.push(r.redirectUrl);
                  })
                }
              >
                Continuer vers le paiement
              </Button>
            </div>
          </Modal>
        </>
      )}
      {canCancel && (
        <>
          <Button block variant="outline" onClick={() => setConfirm(true)}>
            Annuler la commande
          </Button>
          <Modal open={confirm} onClose={() => setConfirm(false)} title="Annuler la commande ?">
            <p className="text-sm text-anthracite-700">Votre part sera libérée. Si vous avez payé, vous serez remboursé intégralement.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" block onClick={() => setConfirm(false)}>
                Garder
              </Button>
              <Button variant="danger" block loading={busy === "cancel"} onClick={() => run("cancel", async () => { await api(`/orders/${orderId}/cancel`, { body: {} }); setConfirm(false); }, "Commande annulée")}>
                Annuler
              </Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}

export function AlternativeDecision({ orderId, itemId, label, supplement }: { orderId: string; itemId: string; label: string; supplement: number }) {
  const { busy, run, router } = useAction();
  return (
    <div className="rounded-[var(--radius-card)] border-2 border-accent-500 bg-accent-100 p-4">
      <p className="font-bold">Une décision est attendue de votre part</p>
      <p className="mt-1 text-sm text-anthracite-800">
        L&apos;achat groupé pour « {label} » n&apos;a pas atteint son seuil. Sesam-Market vous propose un prix alternatif
        {supplement > 0 ? ` (supplément de ${formatFcfa(supplement)})` : ""}. Sans réponse sous 72 h, vous êtes remboursé.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          block
          loading={busy === "accept"}
          onClick={() =>
            run("accept", async () => {
              const r = await api<{ redirectUrl: string }>("/payments", { body: { orderId, method: "CARD", purpose: "SUPPLEMENT", orderItemId: itemId } });
              router.push(r.redirectUrl);
            })
          }
        >
          Accepter
        </Button>
        <Button block variant="outline" loading={busy === "decline"} onClick={() => run("decline", () => api(`/group-buys/alternative/${itemId}`, { body: {} }).then(() => undefined), "Remboursement lancé")}>
          Être remboursé
        </Button>
      </div>
    </div>
  );
}

export function ReviewForm({ orderId, done }: { orderId: string; done: string[] }) {
  const { busy, run } = useAction();
  const [target, setTarget] = useState(done.includes("ORDER") ? "DELIVERY" : "ORDER");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  if (done.includes("ORDER") && done.includes("DELIVERY")) return <p className="text-center text-sm text-economie-700">Merci pour vos avis !</p>;
  return (
    <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="mb-2 font-bold">Donnez votre avis</p>
      <Select label="Sur" value={target} onChange={(e) => setTarget(e.target.value)}>
        {!done.includes("ORDER") && <option value="ORDER">La commande</option>}
        {!done.includes("DELIVERY") && <option value="DELIVERY">La livraison / le retrait</option>}
      </Select>
      <div className="my-3 flex gap-1" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)} className={`text-3xl ${n <= rating ? "" : "opacity-30"}`}>
            ⭐
          </button>
        ))}
      </div>
      <Textarea label="Commentaire" optional value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <Button className="mt-3" block loading={busy === "review"} onClick={() => run("review", () => api("/reviews", { body: { orderId, target, rating, comment: comment || undefined } }).then(() => undefined), "Merci !")}>
        Envoyer
      </Button>
    </div>
  );
}
