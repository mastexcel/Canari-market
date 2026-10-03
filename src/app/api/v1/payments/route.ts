import { route, parseBody } from "@/infrastructure/http/handler";
import { paymentInitSchema } from "@/application/schemas";
import { initiatePayment } from "@/application/payment.service";

export const POST = route({ auth: true, rateLimit: { limit: 10, windowMs: 60_000, key: "user" } }, async ({ req, user, idempotencyKey }) =>
  initiatePayment(user!.id, await parseBody(req, paymentInitSchema), idempotencyKey),
);
