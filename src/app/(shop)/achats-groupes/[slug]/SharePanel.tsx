"use client";
import { useState } from "react";
import { api } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { useToast } from "@/ui/Toast";

export function SharePanel({ url, title, groupBuyId, qrSvg, remaining, unit, loggedIn }: { url: string; title: string; groupBuyId: string; qrSvg: string; remaining: number; unit: string; loggedIn: boolean }) {
  const [qr, setQr] = useState(false);
  const toast = useToast();
  const text = `Rejoins-moi sur Sesam-Market : « ${title} ». ${remaining > 0 ? `Plus que ${remaining} ${unit} pour débloquer le meilleur prix ! ` : ""}Ensemble on paie moins cher 👉 ${url}`;
  const log = (channel: string) => {
    if (loggedIn) api("/referrals/share", { body: { channel, groupBuyId } }).catch(() => undefined);
  };
  return (
    <section className="capsule-sable rounded-[var(--radius-card)] p-4 ring-1 ring-sable-300">
      <h2 className="font-bold text-brand-800">INVITER DES PROCHES</h2>
      <p className="mt-1 text-sm text-anthracite-700">Invitez 5 personnes à rejoindre cet achat : plus le groupe grandit, plus le prix baisse pour tous.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-anthracite-900" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => log("whatsapp")}>
          WhatsApp
        </a>
        <a className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1877F2] font-semibold text-white" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" onClick={() => log("facebook")}>
          Facebook
        </a>
        <Button
          variant="secondary"
          onClick={async () => {
            log("link");
            try {
              await navigator.clipboard.writeText(url);
              toast("Lien copié");
            } catch {
              toast(url, "info");
            }
          }}
        >
          Copier le lien
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            log("qr");
            setQr(true);
          }}
        >
          QR code
        </Button>
      </div>
      <Modal open={qr} onClose={() => setQr(false)} title="Scannez pour rejoindre">
        <div className="mx-auto w-64" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-3 text-center text-sm text-anthracite-600">{title}</p>
      </Modal>
    </section>
  );
}
