"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/ui/Field";
import { Alert } from "@/ui/Alert";
import { useCommand } from "@/ui/pro/Command";

const card = "space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]";

export function PublishPanel({ id, warnings, requiresAck }: { id: string; warnings: Array<{ severity: string; message: string; code: string }>; requiresAck: boolean }) {
  const { send, busy, error } = useCommand("admin");
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState("");
  const stale = warnings.some((w) => w.code === "STALE_REFERENCE");
  return (
    <div className={card}>
      <p className="font-bold">Publication</p>
      {warnings.length === 0 ? <Alert tone="success">Économie unitaire saine à tous les paliers.</Alert> : <Alert tone={requiresAck ? "error" : "warning"} title={requiresAck ? "Campagne structurellement déficitaire" : "Points d'attention"}>{warnings.map((w) => w.message).join(" ")}</Alert>}
      {requiresAck && !stale && (
        <>
          <Checkbox label="Je confirme publier cette campagne malgré le déficit prévu." checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <Textarea label="Justification (journalisée)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. campagne d'acquisition validée par la direction, budget X." />
        </>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button loading={busy} disabled={stale || (requiresAck && (!ack || reason.trim().length < 15))} onClick={() => send({ type: "groupbuy.publish", id, acknowledgeDeficit: ack, reason: reason || undefined }, "Achat groupé publié")}>
        Publier
      </Button>
    </div>
  );
}

export function RfqForm({ id, unitLabel, units }: { id: string; unitLabel: string; units: number }) {
  const { send, busy } = useCommand("admin");
  const d = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const [f, setF] = useState({ quality: "Conforme à l'échantillon validé", packaging: unitLabel, destination: "Entrepôt Sesam-Market Yopougon", neededBy: d(5), closesAt: d(2) });
  return (
    <div className={card}>
      <p className="font-bold">Créer la demande de cotation (RFQ) — {units} × {unitLabel}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Qualité" value={f.quality} onChange={(e) => setF({ ...f, quality: e.target.value })} />
        <Input label="Conditionnement" value={f.packaging} onChange={(e) => setF({ ...f, packaging: e.target.value })} />
        <Input label="Destination" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} />
        <Input label="Clôture des offres" type="date" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} />
        <Input label="Livraison souhaitée" type="date" value={f.neededBy} onChange={(e) => setF({ ...f, neededBy: e.target.value })} />
      </div>
      <Button loading={busy} onClick={() => send({ type: "groupbuy.rfq", id, ...f, closesAt: `${f.closesAt}T18:00:00Z`, neededBy: `${f.neededBy}T12:00:00Z` }, "RFQ envoyée aux fournisseurs vérifiés")}>
        Envoyer la RFQ
      </Button>
    </div>
  );
}

export function AwardForm({ rfqId, offers, bestId }: { rfqId: string; offers: Array<{ id: string; label: string; eligible: boolean }>; bestId: string }) {
  const { send, busy } = useCommand("admin");
  const [choice, setChoice] = useState(bestId);
  const [justification, setJustification] = useState("");
  return (
    <div className="space-y-2 border-t border-gris-200 pt-3">
      <Select label="Offre retenue" value={choice} onChange={(e) => setChoice(e.target.value)}>
        {offers.map((o) => (
          <option key={o.id} value={o.id} disabled={!o.eligible}>
            {o.label}
            {o.eligible ? "" : " (non éligible)"}
          </option>
        ))}
      </Select>
      {choice !== bestId && <Textarea label="Justification obligatoire" value={justification} onChange={(e) => setJustification(e.target.value)} />}
      <Button loading={busy} onClick={() => send({ type: "rfq.award", rfqId, responseId: choice, justification: justification || undefined }, "Bon de commande émis")}>
        Attribuer et émettre le bon de commande
      </Button>
    </div>
  );
}

export function ReceiveForm({ poId, expectedUnits }: { poId: string; expectedUnits: number }) {
  const { send, busy } = useCommand("admin");
  const [units, setUnits] = useState(String(expectedUnits));
  const [damaged, setDamaged] = useState("0");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-28">
        <Input label="Unités reçues" type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} />
      </div>
      <div className="w-36">
        <Input label="Avarie (unité de base)" type="number" min={0} value={damaged} onChange={(e) => setDamaged(e.target.value)} />
      </div>
      <Button loading={busy} onClick={() => send({ type: "po.receive", poId, receivedUnits: Number(units), damagedBase: Number(damaged) }, "Réception enregistrée")}>
        Réceptionner
      </Button>
    </div>
  );
}

export function FractionationForm({ groupBuyId, portions }: { groupBuyId: string; portions: Array<{ label: string; base: number }> }) {
  const { send, busy } = useCommand("admin");
  const [portion, setPortion] = useState(String(portions[0]?.base ?? ""));
  const [count, setCount] = useState("10");
  const [loss, setLoss] = useState("0");
  return (
    <div className={card}>
      <p className="font-bold">Enregistrer une préparation</p>
      <div className="grid grid-cols-3 gap-2">
        <Select label="Portion" value={portion} onChange={(e) => setPortion(e.target.value)}>
          {portions.map((p) => (
            <option key={p.base} value={p.base}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input label="Nombre" type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
        <Input label="Perte" type="number" min={0} value={loss} onChange={(e) => setLoss(e.target.value)} hint="unité de base" />
      </div>
      <Button loading={busy} onClick={() => send({ type: "lot.fractionate", groupBuyId, portionBase: Number(portion), portionCount: Number(count), lossBase: Number(loss) }, "Préparation enregistrée")}>
        Enregistrer
      </Button>
    </div>
  );
}

export function AdjustForm({ groupBuyId }: { groupBuyId: string }) {
  const { send, busy } = useCommand("admin");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className={card}>
      <p className="font-bold">Écart d&apos;inventaire</p>
      <Input label="Écart constaté (+/−, unité de base)" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input label="Explication" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button variant="secondary" loading={busy} onClick={() => send({ type: "lot.adjust", groupBuyId, quantityBase: Number(qty), note }, "Écart enregistré")}>
        Enregistrer l&apos;écart
      </Button>
    </div>
  );
}
