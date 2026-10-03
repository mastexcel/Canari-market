import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { rateLimiter } from "@/infrastructure/rate-limit";
import { DomainError } from "@/domain/errors";
import { pickupHandover, pickupReceive, reportIncident } from "@/application/delivery.service";

const orderNumber = z.string().trim().min(5).max(30);
const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("receive"), orderNumber }),
  z.object({ type: z.literal("handover"), orderNumber, code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres") }),
  z.object({ type: z.literal("incident"), deliveryId: z.string().min(1).max(40), reason: z.string().min(5).max(300) }),
]);

export const POST = route({ roles: ["PICKUP_POINT"], rateLimit: { limit: 120, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const cmd = await parseBody(req, command);
  switch (cmd.type) {
    case "receive":
      await pickupReceive(user!.id, cmd.orderNumber);
      return { ok: true };
    case "handover":
      if (!rateLimiter.hit(`otp:${cmd.orderNumber.toUpperCase()}`, 5, 15 * 60_000).allowed) throw new DomainError("RATE_LIMITED", "Trop d'essais de code pour ce colis.");
      await pickupHandover(user!.id, cmd.orderNumber, cmd.code);
      return { ok: true };
    case "incident":
      await reportIncident(user!.id, cmd.deliveryId, cmd.reason);
      return { ok: true };
  }
});
