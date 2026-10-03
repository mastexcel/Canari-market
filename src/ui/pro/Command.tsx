"use client";
/**
 * Composants génériques pour déclencher une commande back-office
 * (POST /api/v1/<espace>/commands) puis rafraîchir la page.
 */
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../api-client";
import { Button } from "../Button";
import { Modal } from "../Modal";
import { useToast } from "../Toast";

type Space = "admin" | "supplier" | "driver" | "pickup";

export function useCommand(space: Space) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  async function send<T = unknown>(body: Record<string, unknown>, success?: string): Promise<T | null> {
    setBusy(true);
    setError(null);
    try {
      const r = await api<T>(`/${space}/commands`, { body });
      if (success) toast(success);
      router.refresh();
      return r;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur inattendue.";
      setError(msg);
      toast(msg, "error");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { send, busy, error };
}

export function CommandButton({
  space,
  body,
  children,
  success,
  confirm,
  variant = "primary",
  size = "sm",
}: {
  space: Space;
  body: Record<string, unknown>;
  children: ReactNode;
  success?: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "accent" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  const { send, busy } = useCommand(space);
  const [open, setOpen] = useState(false);
  if (!confirm) {
    return (
      <Button size={size} variant={variant} loading={busy} onClick={() => send(body, success)}>
        {children}
      </Button>
    );
  }
  return (
    <>
      <Button size={size} variant={variant} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Confirmer">
        <p className="text-sm text-anthracite-700">{confirm}</p>
        <div className="mt-4 flex gap-2">
          <Button block variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button
            block
            variant={variant === "danger" ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              if (await send(body, success)) setOpen(false);
            }}
          >
            Confirmer
          </Button>
        </div>
      </Modal>
    </>
  );
}
