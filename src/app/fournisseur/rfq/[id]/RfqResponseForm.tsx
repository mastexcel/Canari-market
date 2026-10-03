"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Input, Textarea } from "@/ui/Field";
import { Alert } from "@/ui/Alert";
import { useCommand } from "@/ui/pro/Command";
import { formatFcfa } from "@/domain/money";

type Existing = { unitPrice: number; unitsOffered: number; leadTimeDays: number; deliveryLocation: string; conditions: string; qualityNote: string };

export function RfqResponseForm({ rfqId, units, existing }: { rfqId: string; units: number; existing: Existing | null }) {
  const router = useRouter();
  const { send, busy, error } = useCommand("supplier");
  const [f, setF] = useState({
    unitPrice: String(existing?.unitPrice ?? ""),
    unitsOffered: String(existing?.unitsOffered ?? units),
    leadTimeDays: String(existing?.leadTimeDays ?? 3),
    deliveryLocation: existing?.deliveryLocation ?? "Entrepôt Sesam-Market Yopougon",
    conditions: existing?.conditions ?? "",
    qualityNote: existing?.qualityNote ?? "",
    validUntil: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const total = Number(f.unitPrice) * Math.min(Number(f.unitsOffered), units);
  return (
    <form
      className="space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await send(
          {
            type: "rfq.respond",
            rfqId,
            data: { unitPrice: Number(f.unitPrice), unitsOffered: Number(f.unitsOffered), leadTimeDays: Number(f.leadTimeDays), deliveryLocation: f.deliveryLocation, conditions: f.conditions || undefined, qualityNote: f.qualityNote || undefined, validUntil: `${f.validUntil}T23:59:00Z` },
          },
          "Offre envoyée",
        );
        if (r) router.push("/fournisseur");
      }}
    >
      <p className="font-bold">{existing ? "Modifier votre offre" : "Votre offre"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Prix par unité (F)" inputMode="numeric" required value={f.unitPrice} onChange={set("unitPrice")} />
        <Input label="Unités disponibles" inputMode="numeric" required value={f.unitsOffered} onChange={set("unitsOffered")} />
        <Input label="Délai de livraison (jours)" inputMode="numeric" required value={f.leadTimeDays} onChange={set("leadTimeDays")} />
        <Input label="Offre valable jusqu'au" type="date" value={f.validUntil} onChange={set("validUntil")} />
      </div>
      <Input label="Lieu de livraison" value={f.deliveryLocation} onChange={set("deliveryLocation")} />
      <Textarea label="Conditions" optional value={f.conditions} onChange={set("conditions")} placeholder="Paiement à 15 jours, franco entrepôt…" />
      <Input label="Note qualité" optional value={f.qualityNote} onChange={set("qualityNote")} />
      {Number(f.unitPrice) > 0 && <p className="text-sm">Montant estimé : <strong>{formatFcfa(total)}</strong></p>}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" loading={busy}>
        Envoyer l&apos;offre
      </Button>
    </form>
  );
}
