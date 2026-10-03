/**
 * Démo hébergée : remplit la base avec les données d'Abidjan au premier
 * déploiement uniquement (base vide), puis ne fait plus rien.
 * Actif seulement si DEMO_SEED="true" — ne jamais l'activer en production réelle.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.DEMO_SEED !== "true") {
    console.log("DEMO_SEED désactivé : pas de données de démonstration.");
    return;
  }
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) {
    console.log(`Base déjà remplie (${users} utilisateurs) : seed ignoré.`);
    return;
  }
  console.log("Base vide : chargement des données de démonstration…");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, ALLOW_PROD_SEED: "true" } });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
