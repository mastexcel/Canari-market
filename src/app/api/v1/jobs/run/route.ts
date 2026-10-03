import { route } from "@/infrastructure/http/handler";
import { env } from "@/infrastructure/env";
import { safeEqual } from "@/infrastructure/crypto";
import { runScheduledJobs } from "@/application/jobs.service";
import { DomainError } from "@/domain/errors";

/** Déclenché par un cron externe : Authorization: Bearer <CRON_SECRET>. */
export const POST = route({ external: true }, async ({ req }) => {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!safeEqual(token, env().CRON_SECRET)) throw new DomainError("UNAUTHENTICATED", "Jeton invalide.");
  return { result: await runScheduledJobs() };
});
