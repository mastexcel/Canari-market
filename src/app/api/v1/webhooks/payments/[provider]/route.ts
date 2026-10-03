import { route } from "@/infrastructure/http/handler";
import { handlePaymentWebhook } from "@/application/payment.service";

/** Webhook prestataire : corps brut conservé pour la vérification de signature HMAC. */
export const POST = route<{ provider: string }>({ external: true, rateLimit: { limit: 300, windowMs: 60_000 } }, async ({ req, params }) => {
  const raw = await req.text();
  if (raw.length > 64_000) return { status: "ignored" };
  return handlePaymentWebhook(params.provider, raw, req.headers);
});
