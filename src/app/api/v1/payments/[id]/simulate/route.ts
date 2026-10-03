import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { simulateMockPayment } from "@/application/payment.service";

/** Simulateur du prestataire « mock » : refusé si un autre prestataire est actif. */
export const POST = route<{ id: string }>({ auth: true, rateLimit: { limit: 20, windowMs: 60_000, key: "user" } }, async ({ req, user, params }) => {
  const { outcome } = await parseBody(req, z.object({ outcome: z.enum(["PAID", "FAILED"]) }));
  return simulateMockPayment(user!.id, params.id, outcome);
});
