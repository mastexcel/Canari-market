"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button, ButtonLink } from "@/ui/Button";
import { useToast } from "@/ui/Toast";

export function AddBasket({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  if (!loggedIn) return <ButtonLink href={`/connexion?suite=/paniers-famille/${slug}`} block size="lg">Se connecter pour commander</ButtonLink>;
  return (
    <Button
      block
      size="lg"
      loading={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await api("/cart/baskets", { body: { slug } });
          toast("Panier ajouté — modifiable à tout moment");
          router.push("/panier");
          router.refresh();
        } catch (e) {
          toast(e instanceof ApiError ? e.message : "Erreur", "error");
          setLoading(false);
        }
      }}
    >
      Ajouter ce panier
    </Button>
  );
}
