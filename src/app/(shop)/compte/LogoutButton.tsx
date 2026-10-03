"use client";
import { api } from "@/ui/api-client";
import { Button } from "@/ui/Button";

export function LogoutButton() {
  return (
    <Button
      block
      variant="outline"
      onClick={async () => {
        await api("/auth/logout", { body: {} }).catch(() => undefined);
        window.location.assign("/connexion");
      }}
    >
      Se déconnecter
    </Button>
  );
}
