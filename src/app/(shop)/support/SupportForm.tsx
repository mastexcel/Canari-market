"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Input, Select, Textarea } from "@/ui/Field";
import { Card } from "@/ui/Card";
import { useToast } from "@/ui/Toast";

export function SupportForm({ orders, defaultOrderId }: { orders: Array<{ id: string; number: string }>; defaultOrderId?: string }) {
  const [f, setF] = useState({ category: defaultOrderId ? "ORDER" : "OTHER", subject: "", message: "", orderId: defaultOrderId ?? "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <Card className="p-4">
      <h2 className="mb-3 font-bold">Écrire au support</h2>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api("/support", { body: { ...f, orderId: f.orderId || undefined } });
            toast("Demande envoyée. Réponse sous 24 h.");
            setF({ ...f, subject: "", message: "" });
            router.refresh();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : "Erreur", "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Select label="Sujet" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          <option value="ORDER">Commande</option>
          <option value="PAYMENT">Paiement / remboursement</option>
          <option value="DELIVERY">Livraison / retrait</option>
          <option value="PRODUCT">Produit</option>
          <option value="ACCOUNT">Compte</option>
          <option value="OTHER">Autre</option>
        </Select>
        {orders.length > 0 && (
          <Select label="Commande concernée" optional value={f.orderId} onChange={(e) => setF({ ...f, orderId: e.target.value })}>
            <option value="">Aucune</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number}
              </option>
            ))}
          </Select>
        )}
        <Input label="Titre" required minLength={4} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <Textarea label="Message" required minLength={10} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        <Button type="submit" block loading={busy}>
          Envoyer
        </Button>
      </form>
    </Card>
  );
}
