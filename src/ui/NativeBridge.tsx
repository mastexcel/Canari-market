"use client";
/**
 * Intégration avec l'application mobile (coque Capacitor) : inactif dans un navigateur.
 *  - bouton retour Android : page précédente, ou fermeture de l'application à l'accueil ;
 *  - barre d'état aux couleurs de la charte ;
 *  - masque l'écran de démarrage dès que la page est prête ;
 *  - notifications push (FCM) : une fois l'utilisateur connecté, demande l'autorisation,
 *    enregistre l'appareil, et ouvre la bonne page au toucher d'une notification.
 * Les plugins natifs sont lus sur window.Capacitor : aucune dépendance ajoutée au site.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Listener = { remove: () => void };
type MaybeListener = Promise<Listener> | Listener;
type Perm = { receive: "granted" | "denied" | "prompt" | "prompt-with-rationale" };
type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    App?: { addListener: (e: "backButton", cb: (ev: { canGoBack: boolean }) => void) => MaybeListener; exitApp: () => void };
    StatusBar?: { setStyle: (o: { style: "DARK" | "LIGHT" }) => void; setBackgroundColor: (o: { color: string }) => void };
    SplashScreen?: { hide: () => void };
    PushNotifications?: {
      checkPermissions: () => Promise<Perm>;
      requestPermissions: () => Promise<Perm>;
      register: () => Promise<void>;
      createChannel?: (c: { id: string; name: string; description?: string; importance: number; visibility?: number }) => Promise<void>;
      addListener: ((e: "registration", cb: (t: { value: string }) => void) => MaybeListener) &
        ((e: "pushNotificationActionPerformed", cb: (a: { notification: { data?: { url?: string } } }) => void) => MaybeListener);
    };
  };
};

const capacitor = () => (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
/** L'APK n'embarque Firebase que si la compilation l'a configuré (marqueur ajouté à l'user-agent). */
const pushBuilt = () => navigator.userAgent.includes("SesamPush");

let pushReady = false;
let pushPending = false;

async function setupPush(cap: CapacitorBridge) {
  const push = cap.Plugins?.PushNotifications;
  if (pushReady || pushPending || !push || !pushBuilt()) return;
  pushPending = true;
  try {
    const cfg = (await (await fetch("/api/v1/push/config")).json()) as { authenticated: boolean; channels: { fcm: boolean } };
    if (!cfg.authenticated || !cfg.channels.fcm) return;
    let perm = await push.checkPermissions();
    if (perm.receive.startsWith("prompt")) perm = await push.requestPermissions();
    if (perm.receive !== "granted") {
      pushReady = true; // refus : on ne redemande pas pendant cette session
      return;
    }
    await push.createChannel?.({ id: "sesam", name: "Sesam-Market", description: "Achats groupés et commandes", importance: 4, visibility: 1 });
    await push.addListener("registration", ({ value }) => {
      fetch("/api/v1/push/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "FCM", endpoint: value }) }).catch(() => undefined);
    });
    await push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification.data?.url;
      if (url?.startsWith("/")) location.href = url;
    });
    await push.register();
    pushReady = true;
  } catch {
    // Nouvel essai à la prochaine page
  } finally {
    pushPending = false;
  }
}

export function NativeBridge() {
  const pathname = usePathname();

  useEffect(() => {
    const cap = capacitor();
    if (!cap?.isNativePlatform?.()) return;
    document.documentElement.dataset.app = "native";
    const { App, StatusBar, SplashScreen } = cap.Plugins ?? {};
    try {
      StatusBar?.setStyle({ style: "DARK" });
      StatusBar?.setBackgroundColor({ color: "#3b4520" });
    } catch {}
    SplashScreen?.hide();
    let sub: Listener | undefined;
    Promise.resolve(
      App?.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && location.pathname !== "/") history.back();
        else App.exitApp();
      }),
    ).then((l) => (sub = l ?? undefined));
    return () => sub?.remove();
  }, []);

  // Après connexion (changement de page), on enregistre l'appareil pour les notifications
  useEffect(() => {
    const cap = capacitor();
    if (cap?.isNativePlatform?.()) void setupPush(cap);
  }, [pathname]);

  return null;
}
