/**
 * Exécuté à chaque déploiement : crée ou met à jour les univers et rayons du
 * catalogue, puis range les produits dans leur rayon (sans rien supprimer).
 */
import { syncCatalogue } from "../src/application/catalogue-sync.service";
import { prisma } from "../src/infrastructure/db";

syncCatalogue()
  .then((r) => console.log(`Catalogue : ${r.univers} univers, ${r.rayons} rayons, ${r.moved} produit(s) rangé(s).`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
