import { hmacSha256, safeEqual } from "../crypto";
import { WebhookVerificationError } from "./provider";

/** Tolérance anti-rejeu : un webhook plus vieux que 5 minutes est refusé. */
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/** En-tête « t=<ms>,v1=<hmac(secret, t.body)> » (schéma inspiré des standards du marché). */
export function signPayload(secret: string, body: string, timestamp = Date.now()): string {
  return `t=${timestamp},v1=${hmacSha256(secret, `${timestamp}.${body}`)}`;
}

export function verifySignature(secret: string, body: string, header: string | null, now = Date.now()): void {
  if (!header) throw new WebhookVerificationError("Signature absente.");
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) throw new WebhookVerificationError("Signature mal formée.");
  if (Math.abs(now - t) > WEBHOOK_TOLERANCE_MS) throw new WebhookVerificationError("Webhook expiré (rejeu ?).");
  const expected = hmacSha256(secret, `${t}.${body}`);
  if (!safeEqual(expected, parts.v1)) throw new WebhookVerificationError("Signature invalide.");
}
