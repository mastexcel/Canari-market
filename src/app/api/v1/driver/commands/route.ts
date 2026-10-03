import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { rateLimiter } from "@/infrastructure/rate-limit";
import { DomainError } from "@/domain/errors";
import { driverDeliver, driverPickup, driverRespond, reportIncident } from "@/application/delivery.service";

const id = z.string().min(1).max(40);
const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("accept"), deliveryId: id }),
  z.object({ type: z.literal("reject"), deliveryId: id }),
  z.object({ type: z.literal("pickup"), deliveryId: id }),
  z.object({ type: z.literal("deliver"), deliveryId: id, code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres") }),
  z.object({ type: z.literal("incident"), deliveryId: id, reason: z.string().min(5).max(300) }),
]);

export const POST = route({ roles: ["DRIVER"], rateLimit: { limit: 60, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const cmd = await parseBody(req, command);
  switch (cmd.type) {
    case "accept":
    case "reject":
      await driverRespond(user!.id, cmd.deliveryId, cmd.type === "accept");
      return { ok: true };
    case "pickup":
      await driverPickup(user!.id, cmd.deliveryId);
      return { ok: true };
    case "deliver": {
      // Anti force brute du code : 5 essais par livraison et par 15 minutes.
      if (!rateLimiter.hit(`otp:${cmd.deliveryId}`, 5, 15 * 60_000).allowed) throw new DomainError("RATE_LIMITED", "Trop d'essais de code. Contactez le support.");
      await driverDeliver(user!.id, cmd.deliveryId, cmd.code);
      return { ok: true };
    }
    case "incident":
      await reportIncident(user!.id, cmd.deliveryId, cmd.reason);
      return { ok: true };
  }
});
