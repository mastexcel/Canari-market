import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "@/infrastructure/db";

/** Journal d'audit immuable : qui a fait quoi, sur quoi, avant/après. */
export async function audit(
  entry: {
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  },
  db: Db = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: entry.ip ?? null,
    },
  });
}
