"use client";
/**
 * Intégration avec l'application mobile (coque Capacitor) : inactif dans un navigateur.
 *  - bouton retour Android : page précédente, ou fermeture de l'application à l'accueil ;
 *  - barre d'état aux couleurs de la charte ;
 *  - masque l'écran de démarrage dès que la page est prête.
 * Les plugins natifs sont lus sur window.Capacitor : aucune dépendance ajoutée au site.
 */
import { useEffect } from "react";

type Listener = { remove: () => void };
type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  Plugins?: {
    App?: { addListener: (e: "backButton", cb: (ev: { canGoBack: boolean }) => void) => Promise<Listener> | Listener; exitApp: () => void };
    StatusBar?: { setStyle: (o: { style: "DARK" | "LIGHT" }) => void; setBackgroundColor: (o: { color: string }) => void };
    SplashScreen?: { hide: () => void };
  };
};

export function NativeBridge() {
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
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
  return null;
}
