"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button, ButtonLink } from "@/ui/Button";
import { ChoiceCard } from "@/ui/Field";
import { QuantityStepper } from "@/ui/QuantityStepper";
import { useToast } from "@/ui/Toast";
import { Alert } from "@/ui/Alert";
import { formatFcfa } from "@/domain/money";
import { formatQuantity, type BaseUnit } from "@/domain/units";

interface Portion {
  id: string;
  label: string;
  quantityBase: number;
  unitPrice: number;
  fee: number;
  reference: number | null;
  saving: number | null;
  targetPrice: number;
}

export function JoinPanel(props: {
  loggedIn: boolean;
  slug: string;
  unitLabel: string;
  failurePolicy: string;
  myQuantityBase: number;
  baseUnit: BaseUnit;
  portions: Portion[];
  full: boolean;
}) {
  const [portionId, setPortionId] = useState(props.portions[Math.min(1, props.portions.length - 1)]?.id);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const portion = props.portions.find((p) => p.id === portionId);

  async function join() {
    if (!portion) return;
    setLoading(true);
    setError(null);
    try {
      await api("/cart/items", { body: { kind: "GROUP_BUY", portionId: portion.id, quantity: qty } });
      toast("Ajouté au panier ✔");
      router.push("/panier");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="choisir" className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
      <h2 id="choisir" className="mb-3 text-lg font-bold">
        Choisissez votre part
      </h2>
      {props.myQuantityBase > 0 && (
        <p className="mb-3 rounded-xl bg-economie-50 p-2 text-sm text-economie-700">Vous participez déjà pour {formatQuantity(props.myQuantityBase, props.baseUnit)}.</p>
      )}
      <div className="grid gap-2" role="radiogroup" aria-label="Portions">
        {props.portions.map((p) => (
          <ChoiceCard
            key={p.id}
            name="portion"
            value={p.id}
            checked={p.id === portionId}
            onChange={setPortionId}
            title={p.label}
            description={p.fee > 0 ? `dont fractionnement ${formatFcfa(p.fee)}` : "Sac entier, sans fractionnement"}
            aside={
              <span className="text-right">
                <span className="block font-extrabold tabular text-brand-700">{formatFcfa(p.unitPrice + p.fee)}</span>
                {p.saving ? <span className="block text-xs font-semibold text-economie-700">−{formatFcfa(p.saving)}</span> : null}
              </span>
            }
          />
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm font-semibold">Quantité</span>
        <QuantityStepper value={qty} onChange={setQty} max={20} label="Nombre de portions" />
      </div>
      {portion && (
        <p className="mt-3 text-sm text-anthracite-700">
          Total : <strong className="tabular">{formatFcfa((portion.unitPrice + portion.fee) * qty)}</strong>
          {portion.targetPrice < portion.unitPrice && <>, tombera à {formatFcfa((portion.targetPrice + portion.fee) * qty)} si l&apos;objectif est atteint (différence remboursée).</>}
        </p>
      )}
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
      <div className="mt-4">
        {props.full ? (
          <Button block disabled>
            Capacité atteinte
          </Button>
        ) : props.loggedIn ? (
          <Button block size="lg" onClick={join} loading={loading}>
            REJOINDRE L&apos;ACHAT
          </Button>
        ) : (
          <ButtonLink href={`/connexion?suite=/achats-groupes/${props.slug}`} block size="lg">
            Se connecter pour rejoindre
          </ButtonLink>
        )}
      </div>
    </section>
  );
}
