/**
 * Prestataire simulé pour le développement et les tests.
 * La « page de paiement » est /paiement/[paymentId] dans l'application ;
 * le résultat est renvoyé via un webhook signé, exactement comme en production.
 */
import { z } from "zod";
import { randomToken } from "../crypto";
import { signPayload, verifySignature } from "./signature";
import {
  WebhookVerificationError,
  type CreateChargeInput,
  type CreateChargeResult,
  type PaymentProvider,
  type ProviderEvent,
  type RefundInput,
  type RefundResult,
} from "./provider";

export const MOCK_SIGNATURE_HEADER = "x-canari-signature";

const eventSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1),
  status: z.enum(["PENDING", "AUTHORIZED", "PAID", "FAILED"]),
  amount: z.number().int().nonnegative(),
  failure_reason: z.string().optional(),
});

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  constructor(private readonly secret: string) {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    return { providerRef: `mock_${input.paymentId}`, redirectUrl: `/paiement/${input.paymentId}` };
  }

  async parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent> {
    verifySignature(this.secret, rawBody, headers.get(MOCK_SIGNATURE_HEADER));
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError("Corps JSON invalide.");
    }
    const e = eventSchema.parse(json);
    return {
      eventId: e.id,
      providerRef: e.reference,
      status: e.status,
      amount: e.amount,
      failureReason: e.failure_reason,
      sanitized: { id: e.id, reference: e.reference, status: e.status, amount: e.amount },
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return { providerRefundRef: `mockrf_${input.refundId}`, status: "SUCCEEDED" };
  }

  /** Construit un webhook signé (utilisé par le simulateur et les tests). */
  buildWebhook(event: { reference: string; status: "PAID" | "FAILED"; amount: number; failureReason?: string }) {
    const body = JSON.stringify({
      id: `evt_${randomToken(12)}`,
      reference: event.reference,
      status: event.status,
      amount: event.amount,
      ...(event.failureReason ? { failure_reason: event.failureReason } : {}),
    });
    return { body, headers: new Headers({ [MOCK_SIGNATURE_HEADER]: signPayload(this.secret, body), "content-type": "application/json" }) };
  }
}
