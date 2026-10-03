"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Alert } from "@/ui/Alert";

export function MockPayActions({ paymentId, orderId }: { paymentId: string; orderId: string }) {
  const [busy, setBusy] = useState<"PAID" | "FAILED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function run(outcome: "PAID" | "FAILED") {
    setBusy(outcome);
    setError(null);
    try {
      await api(`/payments/${paymentId}/simulate`, { body: { outcome } });
      router.replace(outcome === "PAID" ? `/commandes/${orderId}?confirmee=1` : `/commandes/${orderId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Erreur");
      setBusy(null);
    }
  }
  return (
    <div className="mt-4 space-y-2">
      <Button block size="lg" onClick={() => run("PAID")} loading={busy === "PAID"} disabled={!!busy}>
        ✅ Simuler un paiement réussi
      </Button>
      <Button block variant="outline" onClick={() => run("FAILED")} loading={busy === "FAILED"} disabled={!!busy}>
        Simuler un échec
      </Button>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}
