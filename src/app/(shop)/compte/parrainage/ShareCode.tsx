"use client";
import { api } from "@/ui/api-client";
import { useToast } from "@/ui/Toast";

export function ShareCode({ link }: { link: string }) {
  const toast = useToast();
  const text = `Rejoins CANARI : on achète ensemble pour payer moins cher. Inscris-toi avec mon lien : ${link}`;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" onClick={() => api("/referrals/share", { body: { channel: "whatsapp" } }).catch(() => undefined)} className="flex h-11 items-center justify-center rounded-xl bg-[#25D366] font-semibold">
        WhatsApp
      </a>
      <button
        className="h-11 rounded-xl border border-bordeaux-200 font-semibold text-bordeaux-700"
        onClick={async () => {
          api("/referrals/share", { body: { channel: "link" } }).catch(() => undefined);
          try {
            await navigator.clipboard.writeText(link);
            toast("Lien copié");
          } catch {
            toast(link, "info");
          }
        }}
      >
        Copier le lien
      </button>
    </div>
  );
}
