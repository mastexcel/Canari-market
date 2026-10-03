"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Field";
import { useToast } from "@/ui/Toast";

export function MembershipButton({ communityId, member, isPublic, inviteCode }: { communityId: string; member: boolean; isPublic: boolean; inviteCode: string | null }) {
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const router = useRouter();
  const toast = useToast();
  async function go(action: "join" | "leave") {
    setBusy(true);
    try {
      await api(`/communities/${communityId}/${action}`, { body: action === "join" ? { inviteCode: code || undefined } : {} });
      toast(action === "join" ? "Bienvenue dans la communauté !" : "Vous avez quitté la communauté");
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }
  if (member) {
    return (
      <div className="space-y-2">
        {inviteCode && <p className="rounded-xl bg-gris-50 p-3 text-center text-sm">Code d&apos;invitation : <strong className="tracking-widest">{inviteCode}</strong></p>}
        <Button block variant="outline" loading={busy} onClick={() => go("leave")}>
          Quitter la communauté
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {!isPublic && <Input label="Code d'invitation" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />}
      <Button block size="lg" loading={busy} onClick={() => go("join")}>
        Rejoindre la communauté
      </Button>
    </div>
  );
}
