/**
 * Exécuté à chaque déploiement : crée ou met à jour les univers et rayons du
 * catalogue, range les produits dans leur rayon (sans rien supprimer) et, sur la
 * démo hébergée (DEMO_SEED=true), ajoute les produits de démonstration des nouveaux rayons.
 */
import { syncCatalogue } from "../src/application/catalogue-sync.service";
import { prisma } from "../src/infrastructure/db";
import { seedDemoExtendedCatalogue } from "../prisma/demo-catalogue";

async function main() {
  const r = await syncCatalogue();
  console.log(`Catalogue : ${r.univers} univers, ${r.rayons} rayons, ${r.moved} produit(s) rangé(s).`);
  if (process.env.DEMO_SEED === "true") {
    console.log(`Démo : ${await seedDemoExtendedCatalogue(prisma)} produit(s) ajouté(s) aux nouveaux rayons.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
