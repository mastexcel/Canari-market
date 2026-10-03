"use client";
import { Alert } from "@/ui/Alert";
import { Button } from "@/ui/Button";

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 py-10">
      <Alert tone="error" title="Impossible d'afficher cette page">
        {error.message && !error.message.includes("prisma") ? error.message : "Vérifiez votre connexion et réessayez."}
      </Alert>
      <Button onClick={reset} block>
        Réessayer
      </Button>
    </div>
  );
}
