// Génère les icônes PWA (PNG) à partir du logo SVG. Usage : node scripts/generate-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${48 + pad * 2} ${48 + pad * 2}">
<rect x="${-pad}" y="${-pad}" width="${48 + pad * 2}" height="${48 + pad * 2}" fill="#8e1b3a"/>
<circle cx="24" cy="24" r="24" fill="#8e1b3a"/>
<path d="M12 30c0-7 5.5-12 12.5-12 3 0 5.4.9 7.2 2.4l4.8-1.6-2.6 4.3c.7 1.4 1.1 3 1.1 4.9 0 6.4-5.4 10-12 10-6.9 0-11-3.3-11-8z" fill="#f5a524"/>
<path d="M17 29.5c3.5 0 7.5 1.5 9.5 4.5-4.5.8-9-.6-11.5-3.6.5-.6 1.2-.9 2-.9z" fill="#db8a0b"/>
<circle cx="30.5" cy="24" r="1.6" fill="#1f2023"/>
<path d="M36.6 25.2l5.4 1.3-5.4 1.7z" fill="#f8ba4d"/>
<path d="M18 38.5h12" stroke="#fde3b0" stroke-width="1.6" stroke-linecap="round"/></svg>`;

writeFileSync("public/icons/icon.svg", mark(0));
for (const [name, size, pad] of [["icon-192.png", 192, 2], ["icon-512.png", 512, 2], ["maskable-512.png", 512, 10], ["apple-touch-icon.png", 180, 4]]) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
}
console.log("Icônes générées.");
