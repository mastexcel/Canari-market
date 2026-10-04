/**
 * Visuels par convention de nommage : un fichier déposé dans public/images
 * est utilisé automatiquement ; sinon l'interface garde le pictogramme (emoji).
 * Les chemins attendus sont listés dans docs/PROMPTS_IMAGES.md.
 */
import { existsSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, boolean>();
const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Retourne le chemin public si le fichier existe (vérification mise en cache par processus). */
export function publicAsset(rel: string): string | null {
  let ok = cache.get(rel);
  if (ok === undefined) {
    ok = existsSync(path.join(PUBLIC_DIR, rel));
    // En développement, on revérifie à chaque fois pour voir les nouvelles images sans redémarrer.
    if (process.env.NODE_ENV === "production") cache.set(rel, ok);
  }
  return ok ? `/${rel}` : null;
}

export const productImage = (slug: string, explicit?: string | null) => explicit || publicAsset(`images/produits/${slug}.webp`);
export const categoryImage = (slug: string) => publicAsset(`images/categories/${slug}.webp`);
export const basketImage = (slug: string) => publicAsset(`images/paniers/${slug}.webp`);
export const communityImage = (slug: string) => publicAsset(`images/communautes/${slug}.webp`);
export const iconImage = (name: string) => publicAsset(`images/icones/${name}.webp`);
export const illustration = (folder: "onboarding" | "hero" | "etats" | "communication", name: string) => publicAsset(`images/${folder}/${name}.webp`);
