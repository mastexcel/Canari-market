"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { QuantityStepper } from "@/ui/QuantityStepper";
import { useToast } from "@/ui/Toast";
import { formatFcfa } from "@/domain/money";

export function CartLineControls({ id, quantity, total }: { id: string; quantity: number; total: number }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function update(q: number) {
    setBusy(true);
    try {
      if (q === 0) await api(`/cart/items/${id}`, { method: "DELETE" });
      else await api(`/cart/items/${id}`, { method: "PATCH", body: { quantity: q } });
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`mt-2 flex items-center justify-between ${busy ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <QuantityStepper value={quantity} onChange={update} label="Quantité" />
        <button onClick={() => update(0)} className="text-sm font-semibold text-alerte-700 underline-offset-2 hover:underline">
          Retirer
        </button>
      </div>
      <span className="tabular font-bold">{formatFcfa(total)}</span>
    </div>
  );
}
