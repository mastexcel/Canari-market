"use client";
import { api } from "../api-client";

export function ProLogout() {
  return (
    <button
      className="font-semibold text-bordeaux-700 underline"
      onClick={async () => {
        await api("/auth/logout", { body: {} }).catch(() => undefined);
        window.location.assign("/connexion");
      }}
    >
      Se déconnecter
    </button>
  );
}
