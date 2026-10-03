"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";
import { useCommand } from "@/ui/pro/Command";

/**
 * Guichet : réception des colis (scan ou saisie du n° de commande) et remise
 * au client contre son code à 6 chiffres. Le QR du client contient
 * « SESAM:<n° commande>:<code> » : un lecteur QR en mode clavier remplit les deux champs.
 */
export function PickupDesk({ incoming }: { incoming: Array<{ number: string; name: string; id: string }> }) {
  const { send, busy } = useCommand("pickup");
  const [number, setNumber] = useState("");
  const [code, setCode] = useState("");
  function onScan(v: string) {
    const m = v.trim().match(/^SESAM:([A-Z0-9-]+):(\d{6})$/i);
    if (m) {
      setNumber(m[1].toUpperCase());
      setCode(m[2]);
    } else setNumber(v.toUpperCase());
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-bold">📥 Réception des colis</h2>
        {incoming.length === 0 ? (
          <p className="text-sm text-anthracite-600">Aucun colis en route.</p>
        ) : (
          <ul className="space-y-2">
            {incoming.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {i.number} · {i.name}
                </span>
                <Button size="sm" loading={busy} onClick={() => send({ type: "receive", orderNumber: i.number }, `Colis ${i.number} reçu — client prévenu`)}>
                  Reçu
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
        <h2 className="font-bold">📤 Remise au client</h2>
        <Input label="N° de commande (ou scan du QR)" value={number} onChange={(e) => onScan(e.target.value)} placeholder="SES-261003-XXXXX" />
        <Input label="Code de retrait du client" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <Button
          block
          loading={busy}
          disabled={!number || code.length !== 6}
          onClick={async () => {
            if (await send({ type: "handover", orderNumber: number, code }, "Colis remis ✔")) {
              setNumber("");
              setCode("");
            }
          }}
        >
          Valider la remise
        </Button>
        <p className="text-xs text-anthracite-500">5 essais maximum par colis : en cas d&apos;échecs répétés, contactez le support Sesam-Market.</p>
      </section>
    </div>
  );
}
