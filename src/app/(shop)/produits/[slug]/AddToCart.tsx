"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button, ButtonLink } from "@/ui/Button";
import { QuantityStepper } from "@/ui/QuantityStepper";
import { useToast } from "@/ui/Toast";

export function AddToCart({ variantId, loggedIn, available, next }: { variantId: string; loggedIn: boolean; available: number; next: string }) {
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const router = useRouter();
  if (!loggedIn) return <ButtonLink href={`/connexion?suite=${next}`} variant="secondary" size="sm">Se connecter pour acheter</ButtonLink>;
  if (available <= 0) return <p className="text-sm font-semibold text-anthracite-500">Rupture de stock</p>;
  return (
    <div className="flex items-center gap-3">
      <QuantityStepper value={qty} onChange={setQty} max={Math.min(20, available)} label="Quantité" />
      <Button
        loading={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await api("/cart/items", { body: { kind: "STOCK", variantId, quantity: qty } });
            toast("Ajouté au panier ✔");
            router.refresh();
          } catch (e) {
            toast(e instanceof ApiError ? e.message : "Erreur", "error");
          } finally {
            setLoading(false);
          }
        }}
      >
        Ajouter
      </Button>
    </div>
  );
}
