"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";
import { useCommand } from "@/ui/pro/Command";

export function ProductTierForm({ id, name, unitLabel, capacity, lead, tiers }: { id: string; name: string; unitLabel: string; capacity: number; lead: number; tiers: Array<{ minUnits: number; unitPrice: number }> }) {
  const { send, busy } = useCommand("supplier");
  const [cap, setCap] = useState(String(capacity));
  const [days, setDays] = useState(String(lead));
  const [rows, setRows] = useState(tiers.length ? tiers.map((t) => ({ minUnits: String(t.minUnits), unitPrice: String(t.unitPrice) })) : [{ minUnits: "1", unitPrice: "" }]);
  return (
    <div className="space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="font-bold">
        {name} <span className="text-sm font-normal text-anthracite-600">· {unitLabel}</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Capacité / semaine (unités)" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
        <Input label="Délai (jours)" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <Input label="À partir de (unités)" inputMode="numeric" value={r.minUnits} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, minUnits: e.target.value } : x)))} />
          <Input label="Prix unitaire (F)" inputMode="numeric" value={r.unitPrice} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setRows([...rows, { minUnits: "", unitPrice: "" }])}>
          + Palier
        </Button>
        <Button
          size="sm"
          loading={busy}
          onClick={() => send({ type: "product.update", supplierProductId: id, capacityUnitsPerWeek: Number(cap), leadTimeDays: Number(days), tiers: rows.map((r) => ({ minUnits: Number(r.minUnits), unitPrice: Number(r.unitPrice) })) }, "Tarifs enregistrés")}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
