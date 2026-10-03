"use client";
import { useState } from "react";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";
import { Alert } from "@/ui/Alert";

export function LoginForm({ next }: { next: string | null }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ redirect: string }>("/auth/login", { body: { phone, password } });
          document.cookie = "canari_onboarded=1; path=/; max-age=31536000; samesite=lax";
          // Navigation complète : repart d'un cache client vierge avec la nouvelle session.
          window.location.assign(next ?? r.redirect);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Erreur");
          setBusy(false);
        }
      }}
    >
      <Input label="Numéro de téléphone" inputMode="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 07 12 34 56" />
      <Input label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block size="lg" loading={busy}>
        Se connecter
      </Button>
    </form>
  );
}
