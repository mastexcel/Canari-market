"use client";
import { useRouter } from "next/navigation";
import { api } from "@/ui/api-client";
import { Button } from "@/ui/Button";

export function MarkRead() {
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" onClick={async () => { await api("/notifications", { body: {} }); router.refresh(); }}>
      Tout lire
    </Button>
  );
}
