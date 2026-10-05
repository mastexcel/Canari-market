/**
 * Démo hébergée, à chaque déploiement :
 *  1. harmonise la ponctuation des données de démonstration (« Riz parfumé — sac » → « Riz parfumé, sac ») ;
 *  2. aligne le mot de passe des comptes de démonstration sur DEMO_PASSWORD.
 * Les comptes du seed partagent tous le même hachage ; on le repère (hachage partagé par
 * plus de 10 comptes) et on le remplace s'il ne correspond pas à DEMO_PASSWORD.
 * Les comptes créés par de vrais utilisateurs (hachages uniques) ne sont jamais modifiés.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/infrastructure/auth/password";

async function main() {
  const target = process.env.DEMO_PASSWORD;
  if (process.env.DEMO_SEED !== "true" || !target) {
    console.log("Pas de démo hébergée (DEMO_SEED / DEMO_PASSWORD) : rien à faire.");
    return;
  }
  const prisma = new PrismaClient();
  try {
    // 1. Ponctuation : pas de tiret cadratin au milieu des titres et des sources
    const fixed =
      (await prisma.$executeRaw`UPDATE "GroupBuy" SET "title" = replace("title", ' — ', ', '), "referenceSource" = replace("referenceSource", ' — ', ', ') WHERE "title" LIKE '% — %' OR "referenceSource" LIKE '% — %'`) +
      (await prisma.$executeRaw`UPDATE "ReferencePrice" SET "sourceLabel" = replace("sourceLabel", ' — ', ', ') WHERE "sourceLabel" LIKE '% — %'`) +
      (await prisma.$executeRaw`UPDATE "OrderItem" SET "label" = replace("label", ' — ', ', ') WHERE "label" LIKE '% — %'`) +
      (await prisma.$executeRaw`UPDATE "Notification" SET "title" = replace("title", ' — ', ', '), "body" = replace("body", ' — ', ', ') WHERE "title" LIKE '% — %' OR "body" LIKE '% — %'`);
    if (fixed) console.log(`Ponctuation harmonisée sur ${fixed} lignes.`);

    // 2. Mot de passe des comptes de démonstration
    const groups = await prisma.user.groupBy({ by: ["passwordHash"], _count: { _all: true }, orderBy: { _count: { passwordHash: "desc" } }, take: 1 });
    const demo = groups[0];
    if (!demo || demo._count._all < 10) {
      console.log("Comptes de démonstration introuvables : rien à faire.");
      return;
    }
    if (await verifyPassword(target, demo.passwordHash)) {
      console.log(`Mot de passe de démonstration déjà à jour (${demo._count._all} comptes).`);
      return;
    }
    const { count } = await prisma.user.updateMany({ where: { passwordHash: demo.passwordHash }, data: { passwordHash: await hashPassword(target) } });
    console.log(`Mot de passe de démonstration mis à jour pour ${count} comptes.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
