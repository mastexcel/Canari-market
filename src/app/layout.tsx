import type { Metadata, Viewport } from "next";
import { publicAsset } from "@/infrastructure/assets";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/ui/Toast";
import { ServiceWorker } from "@/ui/ServiceWorker";
import { CookieNotice } from "@/ui/CookieNotice";

/**
 * Typographie (auto-hébergée par Next : aucun appel à Google côté client, latin seulement) :
 *  - Fredoka : titres, boutons et nom de marque — arrondie comme les lettres du logo ;
 *  - Nunito : texte courant — terminaisons arrondies assorties, grande hauteur d'x,
 *    accents français soignés, très lisible en petite taille sur mobile.
 */
const display = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka", display: "swap" });
const text = Nunito({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-nunito", display: "swap" });

const baseMetadata: Metadata = {
  title: { default: "Sesam-Market — À plusieurs, les prix s’ouvrent", template: "%s · Sesam-Market" },
  description: "Centrale d'achat numérique pour les ménages et petits commerces de Côte d'Ivoire. Plus nous sommes nombreux à acheter ensemble, moins nous payons cher.",
  manifest: "/manifest.webmanifest",
  applicationName: "Sesam-Market",
  appleWebApp: { capable: true, title: "Sesam-Market", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

/** Aperçu de partage (WhatsApp, Facebook) : JPEG, format le mieux pris en charge par les aperçus de liens. */
export function generateMetadata(): Metadata {
  const share = publicAsset("images/communication/partage.jpg");
  return {
    ...baseMetadata,
    metadataBase: new URL(process.env.APP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000"),
    openGraph: {
      title: "Sesam-Market — À plusieurs, les prix s’ouvrent",
      description: "Achats groupés de produits du quotidien à Abidjan : plus nous sommes nombreux, plus les prix baissent.",
      locale: "fr_CI",
      siteName: "Sesam-Market",
      type: "website",
      ...(share ? { images: [{ url: share, width: 1200, height: 630, alt: "Sesam-Market — À plusieurs, les prix s’ouvrent" }] } : {}),
    },
    twitter: { card: "summary_large_image", ...(share ? { images: [share] } : {}) },
  };
}

export const viewport: Viewport = {
  themeColor: "#0e5f36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${display.variable} ${text.variable}`}>
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
          Aller au contenu
        </a>
        <CookieNotice />
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
