/**
 * Génère l'icône et l'écran de démarrage de l'application (Android et iOS)
 * à partir du logo et du fond d'écran de la charte (dossier public/ du site).
 * Usage : npm run assets (depuis mobile/, après « npm install » à la racine du dépôt).
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const sharp = createRequire(path.join(root, "package.json"))("sharp");
const pub = (p) => path.join(root, "public", p);
const res = path.join(here, "../android/app/src/main/res");
const ios = path.join(here, "../ios/App/App/Assets.xcassets");

const MARK = pub("brand/mark.webp"); // chariot seul
const STACK = pub("brand/logo-empile.webp"); // chariot + nom + slogan
const BG_PORTRAIT = pub("backgrounds/accueil-portrait.webp");
const BG_LANDSCAPE = pub("backgrounds/accueil-paysage.webp");

/** Logo posé sur un fond blanc (icône classique et icône ronde). */
async function icon(size, round) {
  const logo = await sharp(MARK).resize(Math.round(size * 0.78), Math.round(size * 0.78), { fit: "contain", background: "#0000" }).toBuffer();
  const mask = Buffer.from(round ? `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>` : `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}"/></svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: "#ffffff" } })
    .composite([{ input: logo, gravity: "center" }, { input: mask, blend: "dest-in" }])
    .png();
}

/** Premier plan de l'icône adaptative Android (108 dp, zone sûre de 66 dp au centre). */
async function foreground(size) {
  const logo = await sharp(MARK).resize(Math.round(size * 0.6), Math.round(size * 0.6), { fit: "contain", background: "#0000" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#0000" } }).composite([{ input: logo, gravity: "center" }]).png();
}

/** Écran de démarrage : fond olive de la charte, logo complet sur un halo clair. */
async function splash(width, height) {
  const landscape = width > height;
  const bg = await sharp(landscape ? BG_LANDSCAPE : BG_PORTRAIT).resize(width, height, { fit: "cover" }).toBuffer();
  const d = Math.round(Math.min(width, height) * 0.62);
  const halo = Buffer.from(
    `<svg width="${d}" height="${d}"><defs><radialGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fbfcf3" stop-opacity=".95"/><stop offset=".8" stop-color="#dbe2a6" stop-opacity=".45"/><stop offset="1" stop-color="#dbe2a6" stop-opacity="0"/></radialGradient></defs><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2}" fill="url(#g)"/></svg>`,
  );
  const logo = await sharp(STACK).resize(Math.round(d * 0.74), null).toBuffer();
  return sharp(bg).composite([{ input: halo, gravity: "center" }, { input: logo, gravity: "center" }]).png({ compressionLevel: 9, palette: true, quality: 90 });
}

const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, k] of Object.entries(DENSITIES)) {
  const dir = path.join(res, `mipmap-${name}`);
  await (await icon(Math.round(48 * k), false)).toFile(path.join(dir, "ic_launcher.png"));
  await (await icon(Math.round(48 * k), true)).toFile(path.join(dir, "ic_launcher_round.png"));
  await (await foreground(Math.round(108 * k))).toFile(path.join(dir, "ic_launcher_foreground.png"));
}

// Remplace chaque splash.png existant en gardant ses dimensions (portrait, paysage, toutes densités)
for (const d of readdirSync(res).filter((d) => d.startsWith("drawable"))) {
  const file = path.join(res, d, "splash.png");
  if (!existsSync(file)) continue;
  const { width, height } = await sharp(file).metadata();
  await (await splash(width, height)).toFile(file);
}

// Petite icône de notification Android : silhouette blanche du chariot (24 dp)
for (const [name, k] of Object.entries(DENSITIES)) {
  const size = Math.round(24 * k);
  const dir = path.join(res, `drawable-${name}`);
  mkdirSync(dir, { recursive: true });
  const alpha = await sharp(MARK).resize(size, size, { fit: "contain", background: "#0000" }).ensureAlpha().extractChannel("alpha").toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: "#ffffff" } }).joinChannel(alpha).png().toFile(path.join(dir, "ic_stat_sesam.png"));
}

if (existsSync(ios)) {
  await (await icon(1024, false)).flatten({ background: "#ffffff" }).toFile(path.join(ios, "AppIcon.appiconset/AppIcon-512@2x.png"));
  for (const f of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    await (await splash(2732, 2732)).toFile(path.join(ios, "Splash.imageset", f));
  }
}
console.log("Icônes et écrans de démarrage générés.");
