import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/ui/Toast";
import { ServiceWorker } from "@/ui/ServiceWorker";

export const metadata: Metadata = {
  title: { default: "Sesam-Market — À plusieurs, les prix s’ouvrent", template: "%s · Sesam-Market" },
  description: "Centrale d'achat numérique pour les ménages et petits commerces de Côte d'Ivoire. Plus nous sommes nombreux à acheter ensemble, moins nous payons cher.",
  manifest: "/manifest.webmanifest",
  applicationName: "Sesam-Market",
  appleWebApp: { capable: true, title: "Sesam-Market", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e5f36",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh antialiased">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">
          Aller au contenu
        </a>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
