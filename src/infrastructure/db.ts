import { PrismaClient, type Prisma } from "@prisma/client";

/** Client Prisma unique (réutilisé entre rechargements à chaud en développement). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Client ou transaction : les services acceptent l'un ou l'autre. */
export type Db = PrismaClient | Prisma.TransactionClient;

/** Exécute `fn` dans une transaction (ou dans celle déjà ouverte). */
export async function inTransaction<T>(db: Db, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  if ("$transaction" in db) {
    return (db as PrismaClient).$transaction(fn, { timeout: 20_000, maxWait: 10_000 });
  }
  return fn(db);
}
