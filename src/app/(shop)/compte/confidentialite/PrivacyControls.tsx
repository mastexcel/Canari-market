"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Checkbox, Input } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { Card } from "@/ui/Card";
import { useToast } from "@/ui/Toast";

type Key = "MARKETING_SMS" | "MARKETING_WHATSAPP" | "ANALYTICS";
const LABELS: Record<Key, string> = { MARKETING_SMS: "Recevoir les offres par SMS", MARKETING_WHATSAPP: "Recevoir les offres par WhatsApp", ANALYTICS: "Aider à améliorer CANARI (mesure d'audience)" };

export function PrivacyControls({ initial }: { initial: Record<Key, boolean> }) {
  const [state, setState] = useState(initial);
  const [del, setDel] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Card className="space-y-1 p-4">
        <p className="mb-1 font-bold">Mes choix</p>
        {(Object.keys(LABELS) as Key[]).map((k) => (
          <Checkbox
            key={k}
            label={LABELS[k]}
            checked={state[k]}
            onChange={async (e) => {
              const granted = e.target.checked;
              setState({ ...state, [k]: granted });
              try {
                await api("/account/consents", { body: { type: k, granted } });
                toast("Préférence enregistrée");
                router.refresh();
              } catch {
                setState({ ...state, [k]: !granted });
                toast("Erreur", "error");
              }
            }}
          />
        ))}
      </Card>
      <Card className="space-y-2 p-4">
        <p className="font-bold">Mes données</p>
        <a href="/api/v1/account/export" className="flex h-11 items-center justify-center rounded-xl border border-gris-300 font-semibold">
          Télécharger mes données (JSON)
        </a>
        <Button block variant="danger" onClick={() => setDel(true)}>
          Supprimer mon compte
        </Button>
      </Card>
      <Modal open={del} onClose={() => setDel(false)} title="Supprimer mon compte">
        <p className="text-sm text-anthracite-700">Vos informations personnelles seront effacées. Les pièces comptables sont conservées sans lien avec votre identité. Cette action est définitive.</p>
        <div className="mt-3 space-y-3">
          <Input label="Mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          <Input label="Tapez SUPPRIMER pour confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button
            block
            variant="danger"
            loading={busy}
            disabled={confirm !== "SUPPRIMER" || !password}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/account/delete", { body: { password, confirm } });
                router.push("/bienvenue");
                router.refresh();
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "Erreur", "error");
                setBusy(false);
              }
            }}
          >
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </>
  );
}
