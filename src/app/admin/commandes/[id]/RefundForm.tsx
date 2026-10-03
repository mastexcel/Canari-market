"use client";
import { useState } from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";
import { useCommand } from "@/ui/pro/Command";
import { formatFcfa } from "@/domain/money";

export function RefundForm({ orderId, max }: { orderId: string; max: number }) {
  const { send, busy } = useCommand("admin");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="font-bold">Remboursement (réclamation)</p>
      <p className="text-xs text-anthracite-600">Remboursable : {formatFcfa(max)}. Permission « Remboursements » requise ; action journalisée.</p>
      <Input label="Montant (F)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input label="Motif" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button variant="danger" size="sm" loading={busy} disabled={!amount || Number(amount) > max || note.length < 5} onClick={() => send({ type: "order.refund", orderId, amount: Number(amount), note }, "Remboursement lancé")}>
        Rembourser
      </Button>
    </div>
  );
}
