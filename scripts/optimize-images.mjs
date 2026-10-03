/**
 * Convertit les images générées (PNG/JPG) en WebP optimisées pour mobile.
 * Entrée : images-source/<dossier>/<nom>.(png|jpg|jpeg|webp)
 * Sortie : public/images/<dossier>/<nom>.webp
 * Usage : npm run images:optimize
 */
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

// Taille maximale (côté le plus long) et qualité par dossier — poids cible < 60 ko par image.
const RULES = {
  produits: { size: 640, quality: 78, square: true },
  categories: { size: 480, quality: 78 },
  icones: { size: 192, quality: 85, square: true },
  onboarding: { size: 720, quality: 80 },
  hero: { size: 900, quality: 78 },
  etats: { size: 480, quality: 80 },
  communication: { size: 1200, quality: 82 },
};

const SRC = "images-source";
if (!existsSync(SRC)) {
  console.error(`Dossier « ${SRC}/ » introuvable. Créez-le et rangez-y vos images par dossier (produits, categories…).`);
  process.exit(1);
}
let count = 0;
for (const folder of readdirSync(SRC)) {
  const dir = path.join(SRC, folder);
  if (!statSync(dir).isDirectory()) continue;
  const rule = RULES[folder];
  if (!rule) {
    console.warn(`Dossier ignoré (inconnu) : ${folder}`);
    continue;
  }
  const out = path.join("public", "images", folder);
  mkdirSync(out, { recursive: true });
  for (const file of readdirSync(dir)) {
    if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
    const name = file.replace(/\.[^.]+$/, "").toLowerCase();
    let img = sharp(path.join(dir, file)).rotate();
    img = rule.square
      ? img.resize(rule.size, rule.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      : img.resize(rule.size, rule.size, { fit: "inside", withoutEnlargement: true });
    const target = path.join(out, `${name}.webp`);
    await img.webp({ quality: rule.quality, alphaQuality: 85, effort: 5 }).toFile(target);
    const kb = Math.round(statSync(target).size / 1024);
    console.log(`✔ ${target} (${kb} ko)${kb > 90 ? "  ⚠ lourd : réduisez les détails ou la qualité" : ""}`);
    count++;
  }
}
console.log(`${count} image(s) optimisée(s).`);
