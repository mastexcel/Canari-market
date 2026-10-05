"use client";
/**
 * Activation des notifications push sur cet appareil (navigateur ou site installé).
 * Dans l'application mobile, l'autorisation est demandée par l'application elle-même.
 */
import { useEffect, useState } from "react";
import { Button } from "@/ui/Button";

type State = "loading" | "on" | "off" | "denied" | "unsupported" | "ios-install" | "native" | "unavailable" | "error";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

async function api(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/v1/push/devices", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (cap?.isNativePlatform?.()) return setState("native");
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-install" : "unsupported");
      const cfg = (await (await fetch("/api/v1/push/config")).json()) as { vapidPublicKey: string | null };
      if (!cfg.vapidPublicKey) return setState("unavailable");
      setKey(cfg.vapidPublicKey);
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        // Resynchronise l'abonnement (changement de compte sur le même navigateur)
        await api("POST", { kind: "WEB", ...sub.toJSON() }).catch(() => undefined);
        return setState("on");
      }
      setState("off");
    })().catch(() => setState("error"));
  }, []);

  async function enable() {
    if (!key) return;
    setState("loading");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      await api("POST", { kind: "WEB", ...sub.toJSON() });
      setState("on");
    } catch {
      setState("error");
    }
  }

  async function disable() {
    setState("loading");
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await api("DELETE", { endpoint: sub.endpoint }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("error");
    }
  }

  const text: Record<State, string> = {
    loading: "Vérification…",
    on: "Activées sur cet appareil : vous êtes prévenu dès qu’un achat groupé avance ou qu’une commande est prête.",
    off: "Soyez prévenu en temps réel : prix débloqué, paiement confirmé, commande prête au point relais.",
    denied: "Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur, puis revenez ici.",
    unsupported: "Ce navigateur ne gère pas les notifications push. Vos notifications restent visibles ci-dessous.",
    "ios-install": "Sur iPhone : touchez Partager puis « Sur l’écran d’accueil », ouvrez Sesam-Market depuis l’icône, et activez les notifications ici.",
    native: "Les notifications sont gérées par l’application Sesam-Market (Réglages du téléphone → Notifications).",
    unavailable: "Les notifications push seront bientôt disponibles.",
    error: "L’activation n’a pas abouti. Réessayez dans un instant.",
  };

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center" aria-live="polite">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-100 text-xl">
        🔔
      </span>
      <div className="flex-1">
        <p className="font-bold text-anthracite-900">Notifications sur ce téléphone</p>
        <p className="text-sm text-anthracite-700">{text[state]}</p>
      </div>
      {(state === "off" || state === "error") && (
        <Button type="button" variant="accent" onClick={enable} className="shrink-0">
          Activer
        </Button>
      )}
      {state === "on" && (
        <Button type="button" variant="secondary" onClick={disable} className="shrink-0">
          Désactiver
        </Button>
      )}
    </section>
  );
}
