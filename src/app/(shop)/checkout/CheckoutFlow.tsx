"use client";
/**
 * Tunnel de commande : Livraison → Créneau → Récapitulatif → Paiement.
 * Le récapitulatif est calculé par le serveur (même code que la commande).
 * Une clé d'idempotence protège contre le double envoi (réseau instable).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, newIdempotencyKey } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Checkbox, ChoiceCard, Input, Select } from "@/ui/Field";
import { Alert } from "@/ui/Alert";
import { Stepper } from "@/ui/Timeline";
import { Card } from "@/ui/Card";
import { formatBps, formatFcfa } from "@/domain/money";
import { formatDate } from "@/domain/dates";

type Point = { id: string; name: string; commune: string; quartier: string; hours: string; fee: number; landmark: string | null };
type Address = { id: string; label: string; commune: string; quartier: string; landmark: string | null };
type Policy = { title: string; policy: string; text: string };

interface Quote {
  totals: { subtotal: number; referenceTotal: number; savings: number; savingsBps: number; fractionationFees: number; deliveryFee: number; discount: number; creditApplied: number; total: number };
  fee: { base: number; weight: number; distance: number; bulky: number; scheduled: number; discount: number; total: number };
  readyAt: string;
  slots: Array<{ start: string; end: string; label: string }>;
  community: { name: string; level: string } | null;
  creditAvailable: number;
  hasGroupItems: boolean;
}

const STEPS = ["Livraison", "Créneau", "Récapitulatif", "Paiement"];
const OPERATORS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MOMO", label: "MTN MoMo" },
  { value: "MOOV_MONEY", label: "Moov Money" },
  { value: "WAVE", label: "Wave" },
] as const;

export function CheckoutFlow(props: {
  points: Point[];
  addresses: Address[];
  deliverableCommunes: string[];
  communes: string[];
  defaultCommune: string;
  preferredPointId: string | null;
  credit: number;
  policies: Policy[];
  defaultPhone: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"PICKUP" | "HOME_DELIVERY">("PICKUP");
  const [pointId, setPointId] = useState(props.preferredPointId ?? "");
  const [addressId, setAddressId] = useState(props.addresses[0]?.id ?? "new");
  const [newAddr, setNewAddr] = useState({ commune: props.defaultCommune, quartier: "", landmark: "" });
  const [speed, setSpeed] = useState<"STANDARD" | "SCHEDULED">("STANDARD");
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(null);
  const [promo, setPromo] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [creditConsent, setCreditConsent] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(props.policies.length === 0);
  const [method, setMethod] = useState<"MOBILE_MONEY" | "CARD">("MOBILE_MONEY");
  const [operator, setOperator] = useState<(typeof OPERATORS)[number]["value"]>("ORANGE_MONEY");
  const [phone, setPhone] = useState(props.defaultPhone);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const orderKey = useRef(newIdempotencyKey());
  const paymentKey = useRef(newIdempotencyKey());
  const [orderId, setOrderId] = useState<string | null>(null);

  const hasCreditPolicy = props.policies.some((p) => p.policy === "CREDIT_WITH_CONSENT");
  const pointsByCommune = useMemo(() => {
    const m = new Map<string, Point[]>();
    for (const p of props.points) m.set(p.commune, [...(m.get(p.commune) ?? []), p]);
    return [...m.entries()];
  }, [props.points]);

  const payload = () => ({
    fulfillmentMode: mode,
    pickupPointId: mode === "PICKUP" ? pointId : undefined,
    addressId: mode === "HOME_DELIVERY" && addressId !== "new" ? addressId : undefined,
    newAddress: mode === "HOME_DELIVERY" && addressId === "new" ? { label: "Domicile", ...newAddr, landmark: newAddr.landmark || undefined } : undefined,
    deliverySpeed: mode === "HOME_DELIVERY" ? speed : "STANDARD",
    slotStart: mode === "HOME_DELIVERY" && speed === "SCHEDULED" ? slot?.start : undefined,
    slotEnd: mode === "HOME_DELIVERY" && speed === "SCHEDULED" ? slot?.end : undefined,
    promoCode: promo || undefined,
    useCredit,
    creditConsent,
  });

  async function refreshQuote(): Promise<Quote | null> {
    setError(null);
    setLoading(true);
    try {
      // Tant que le créneau programmé n'est pas choisi, on chiffre en standard.
      const body = { ...payload(), ...(mode === "HOME_DELIVERY" && speed === "SCHEDULED" && slot ? {} : { deliverySpeed: "STANDARD", slotStart: undefined, slotEnd: undefined }) };
      const q = await api<Quote>("/checkout/quote", { body });
      setQuote(q);
      return q;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // Le devis est recalculé quand les choix changent au récapitulatif.
  useEffect(() => {
    if (step === 2) void refreshQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, useCredit]);

  async function next() {
    setError(null);
    if (step === 0) {
      if (mode === "PICKUP" && !pointId) return setError("Choisissez un point relais.");
      if (mode === "HOME_DELIVERY" && addressId === "new" && newAddr.quartier.trim().length < 2) return setError("Indiquez votre quartier.");
      const q = await refreshQuote();
      if (q) setStep(1);
      return;
    }
    if (step === 1) {
      if (mode === "HOME_DELIVERY" && speed === "SCHEDULED" && !slot) return setError("Choisissez un créneau.");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!policiesAccepted) return setError("Confirmez avoir pris connaissance des règles de l'achat groupé.");
      setStep(3);
    }
  }

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      let id = orderId;
      if (!id) {
        const res = await api<{ order: { id: string; total: number; status: string } }>("/orders", { body: payload(), idempotencyKey: orderKey.current });
        id = res.order.id;
        setOrderId(id);
        if (res.order.status !== "PENDING_PAYMENT") {
          router.push(`/commandes/${id}?confirmee=1`);
          return;
        }
      }
      const pay = await api<{ redirectUrl: string }>("/payments", {
        body: { orderId: id, method, operator: method === "MOBILE_MONEY" ? operator : undefined, payerPhone: method === "MOBILE_MONEY" ? phone : undefined, purpose: "ORDER" },
        idempotencyKey: paymentKey.current,
      });
      router.push(pay.redirectUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <div className="space-y-3">
          <div className="grid gap-2" role="radiogroup" aria-label="Mode de livraison">
            <ChoiceCard name="mode" value="PICKUP" checked={mode === "PICKUP"} onChange={() => setMode("PICKUP")} title="📍 Point Sesam" description="Le plus économique : retrait avec un code, près de chez vous." />
            <ChoiceCard name="mode" value="HOME_DELIVERY" checked={mode === "HOME_DELIVERY"} onChange={() => setMode("HOME_DELIVERY")} title="🛵 Livraison à domicile" description="Tarif selon commune, poids et créneau." />
          </div>
          {mode === "PICKUP" ? (
            <Select label="Point relais" value={pointId} onChange={(e) => setPointId(e.target.value)}>
              <option value="">Choisir…</option>
              {pointsByCommune.map(([commune, list]) => (
                <optgroup key={commune} label={commune}>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.quartier} ({p.fee ? formatFcfa(p.fee) : "gratuit"})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          ) : (
            <div className="space-y-3">
              {props.addresses.length > 0 && (
                <Select label="Adresse" value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                  {props.addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.quartier}, {a.commune}
                    </option>
                  ))}
                  <option value="new">+ Nouvelle adresse</option>
                </Select>
              )}
              {addressId === "new" && (
                <>
                  <Select label="Commune" value={newAddr.commune} onChange={(e) => setNewAddr({ ...newAddr, commune: e.target.value })} hint={props.deliverableCommunes.includes(newAddr.commune) ? undefined : "Livraison à domicile pas encore disponible ici : choisissez un point relais."}>
                    {props.communes.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                  <Input label="Quartier" value={newAddr.quartier} onChange={(e) => setNewAddr({ ...newAddr, quartier: e.target.value })} placeholder="Ex. Angré 8e Tranche" />
                  <Input label="Repère" optional value={newAddr.landmark} onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })} placeholder="Ex. derrière la pharmacie" />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {step === 1 && quote && (
        <div className="space-y-3">
          <Alert tone="info">Votre commande sera prête à partir du {formatDate(new Date(quote.readyAt))}.</Alert>
          {mode === "PICKUP" ? (
            <p className="text-sm text-anthracite-700">Vous recevrez une notification avec votre code de retrait dès que le colis est au point relais.</p>
          ) : (
            <>
              <div className="grid gap-2" role="radiogroup" aria-label="Type de livraison">
                <ChoiceCard name="speed" value="STANDARD" checked={speed === "STANDARD"} onChange={() => setSpeed("STANDARD")} title="Standard" description={`Premier créneau disponible : ${quote.slots[0]?.label ?? "—"}`} />
                <ChoiceCard name="speed" value="SCHEDULED" checked={speed === "SCHEDULED"} onChange={() => setSpeed("SCHEDULED")} title="Programmée" description="Choisissez votre créneau (supplément)." />
              </div>
              {speed === "SCHEDULED" && (
                <div className="grid gap-2" role="radiogroup" aria-label="Créneau">
                  {quote.slots.map((s) => (
                    <ChoiceCard key={s.start} name="slot" value={s.start} checked={slot?.start === s.start} onChange={() => setSlot({ start: s.start, end: s.end })} title={s.label} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {quote ? (
            <Card className="space-y-1.5 p-4 text-[15px]">
              <Row label="Sous-total" value={formatFcfa(quote.totals.subtotal)} />
              {quote.totals.savings > 0 && <Row label={`Économie Sesam-Market (${formatBps(quote.totals.savingsBps)})`} value={`${formatFcfa(quote.totals.savings)}`} tone="economie" />}
              {quote.totals.fractionationFees > 0 && <Row label="Fractionnement" value={formatFcfa(quote.totals.fractionationFees)} />}
              <Row label={mode === "PICKUP" ? "Retrait au point relais" : "Livraison"} value={quote.totals.deliveryFee ? formatFcfa(quote.totals.deliveryFee) : "Gratuit"} />
              {quote.fee.discount > 0 && <p className="text-xs text-economie-700">Avantage communauté {quote.community?.name} ({quote.community?.level}) : −{formatFcfa(quote.fee.discount)}</p>}
              {quote.totals.discount > 0 && <Row label="Code promo" value={`−${formatFcfa(quote.totals.discount)}`} tone="economie" />}
              {quote.totals.creditApplied > 0 && <Row label="Avoir utilisé" value={`−${formatFcfa(quote.totals.creditApplied)}`} tone="economie" />}
              <div className="border-t border-gris-200 pt-2">
                <Row label="Total" value={formatFcfa(quote.totals.total)} strong />
              </div>
              <p className="text-xs text-anthracite-500">L&apos;économie compare au prix de référence marché daté ; elle n&apos;est pas déduite une seconde fois du total.</p>
            </Card>
          ) : (
            <div className="skeleton h-48 rounded-2xl" />
          )}
          <div className="flex gap-2">
            <Input label="Code promo" optional value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="uppercase" />
            <Button variant="secondary" className="mt-7 shrink-0" onClick={refreshQuote} loading={loading}>
              Appliquer
            </Button>
          </div>
          {props.credit > 0 && <Checkbox label={`Utiliser mon avoir (${formatFcfa(props.credit)} disponibles)`} checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />}
          {props.policies.length > 0 && (
            <div className="rounded-xl border border-accent-600/30 bg-accent-100 p-3 text-sm">
              <p className="font-bold text-accent-700">À savoir avant de payer</p>
              <ul className="mt-1 space-y-1.5 text-anthracite-800">
                {props.policies.map((p) => (
                  <li key={p.title}>
                    <strong>{p.title} :</strong> {p.text}
                  </li>
                ))}
                <li>Vous payez le prix actuel ; si un meilleur palier est atteint, la différence vous est remboursée.</li>
              </ul>
              {hasCreditPolicy && (
                <Checkbox className="mt-2" label="En cas d'échec, je préfère recevoir un avoir Sesam-Market plutôt qu'un remboursement." description="Facultatif. Sans cette case, vous êtes remboursé sur votre moyen de paiement." checked={creditConsent} onChange={(e) => setCreditConsent(e.target.checked)} />
              )}
              <Checkbox className="mt-1" label="J'ai pris connaissance de ces règles." checked={policiesAccepted} onChange={(e) => setPoliciesAccepted(e.target.checked)} />
            </div>
          )}
        </div>
      )}

      {step === 3 && quote && (
        <div className="space-y-3">
          <Card className="p-4 text-center">
            <p className="text-sm text-anthracite-600">Montant à payer</p>
            <p className="text-3xl font-black tabular text-brand-700">{formatFcfa(quote.totals.total)}</p>
          </Card>
          <div className="grid gap-2" role="radiogroup" aria-label="Moyen de paiement">
            <ChoiceCard name="method" value="MOBILE_MONEY" checked={method === "MOBILE_MONEY"} onChange={() => setMethod("MOBILE_MONEY")} title="📱 Mobile Money" description="Orange Money, MTN MoMo, Moov Money, Wave" />
            <ChoiceCard name="method" value="CARD" checked={method === "CARD"} onChange={() => setMethod("CARD")} title="💳 Carte bancaire" description="Saisie sécurisée chez le prestataire — Sesam-Market ne voit jamais votre carte." />
          </div>
          {method === "MOBILE_MONEY" && (
            <>
              <Select label="Opérateur" value={operator} onChange={(e) => setOperator(e.target.value as typeof operator)}>
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Input label="Numéro Mobile Money" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" />
            </>
          )}
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex gap-2">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(step - 1)} disabled={loading || !!orderId}>
            Retour
          </Button>
        )}
        {step < 3 ? (
          <Button block onClick={next} loading={loading}>
            Continuer
          </Button>
        ) : (
          <Button block size="lg" onClick={pay} loading={loading}>
            Payer {quote ? formatFcfa(quote.totals.total) : ""}
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: "economie"; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${tone === "economie" ? "font-semibold text-economie-700" : ""} ${strong ? "text-lg font-extrabold" : ""}`}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
