"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Input, Textarea } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { useCommand } from "@/ui/pro/Command";

export function MissionActions({ deliveryId, status }: { deliveryId: string; status: string }) {
  const { send, busy } = useCommand("driver");
  const router = useRouter();
  const [code, setCode] = useState("");
  const [incident, setIncident] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-2">
      {status === "ASSIGNED" && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="md" loading={busy} onClick={() => send({ type: "accept", deliveryId }, "Mission acceptée")}>
            Accepter
          </Button>
          <Button size="md" variant="outline" loading={busy} onClick={async () => { if (await send({ type: "reject", deliveryId }, "Mission refusée")) router.push("/livreur"); }}>
            Refuser
          </Button>
        </div>
      )}
      {status === "ACCEPTED" && (
        <Button block size="lg" loading={busy} onClick={() => send({ type: "pickup", deliveryId }, "Colis récupéré — le client est prévenu")}>
          J&apos;ai récupéré le colis à l&apos;entrepôt
        </Button>
      )}
      {status === "PICKED_UP" && (
        <div className="space-y-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
          <Input label="Code de livraison du client (6 chiffres)" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
          <Button block size="lg" loading={busy} disabled={code.length !== 6} onClick={async () => { if (await send({ type: "deliver", deliveryId, code }, "Livraison confirmée 🎉")) router.push("/livreur"); }}>
            Confirmer la livraison
          </Button>
        </div>
      )}
      {status !== "ASSIGNED" && (
        <Button block variant="ghost" onClick={() => setIncident(true)}>
          ⚠️ Signaler un incident
        </Button>
      )}
      <Modal open={incident} onClose={() => setIncident(false)} title="Signaler un incident">
        <Textarea label="Que s'est-il passé ?" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Client absent, adresse introuvable, colis endommagé…" />
        <Button className="mt-3" block variant="danger" loading={busy} disabled={reason.length < 5} onClick={async () => { if (await send({ type: "incident", deliveryId, reason }, "Incident signalé")) router.push("/livreur"); }}>
          Envoyer
        </Button>
      </Modal>
    </div>
  );
}
