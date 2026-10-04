import Image from "next/image";
import { cn } from "./cn";

const BG = ["bg-accent-100", "bg-brand-50", "bg-lime-100", "bg-gris-100", "bg-economie-50"];

/**
 * Visuel produit : photo réaliste si elle existe (public/images/produits),
 * sinon pictogramme sur fond coloré (0 octet à télécharger).
 */
export function ProductTile({ emoji, name, src, size = "md", className }: { emoji: string; name: string; src?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const bg = BG[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % BG.length];
  const dims = size === "lg" ? "h-52 text-7xl" : size === "md" ? "h-32 text-5xl" : "size-12 text-2xl";
  const px = size === "lg" ? 480 : size === "md" ? 240 : 96;
  return (
    <div className={cn("relative grid place-items-center overflow-hidden rounded-2xl", src ? "bg-white" : bg, dims, className)} role="img" aria-label={name}>
      {src ? (
        <Image src={src} alt="" fill sizes={`${px}px`} className="object-contain" loading={size === "lg" ? "eager" : "lazy"} />
      ) : (
        <span aria-hidden>{emoji}</span>
      )}
    </div>
  );
}
