import { cn } from "./cn";

const BG = ["bg-canari-100", "bg-bordeaux-50", "bg-economie-50", "bg-gris-100", "bg-info-100"];

/**
 * Visuel produit léger : pictogramme sur fond coloré (0 octet d'image à
 * télécharger). Une vraie photo peut être fournie via imageUrl.
 */
export function ProductTile({ emoji, name, size = "md", className }: { emoji: string; name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const bg = BG[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % BG.length];
  const dims = size === "lg" ? "h-44 text-7xl" : size === "md" ? "h-24 text-5xl" : "size-12 text-2xl";
  return (
    <div className={cn("grid place-items-center rounded-2xl", bg, dims, className)} role="img" aria-label={name}>
      <span aria-hidden>{emoji}</span>
    </div>
  );
}
