/**
 * Abstraction des prestataires de paiement (Mobile Money, carte, wallet).
 * CANARI ne voit ni ne stocke JAMAIS de données de carte : le prestataire
 * héberge la saisie (redirection) et ne renvoie que des références.
 */
export type ProviderPaymentStatus = "PENDING" | "AUTHORIZED" | "PAID" | "FAILED";

export interface CreateChargeInput {
  paymentId: string;
  amount: number; // FCFA
  currency: "XOF";
  method: "MOBILE_MONEY" | "CARD" | "WALLET";
  operator?: "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | "WAVE" | null;
  payerPhone?: string | null;
  description: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface CreateChargeResult {
  providerRef: string;
  /** URL de la page de paiement hébergée par le prestataire */
  redirectUrl: string;
}

export interface ProviderEvent {
  eventId: string;
  providerRef: string;
  status: ProviderPaymentStatus;
  amount: number;
  failureReason?: string;
  /** Charge utile assainie, conservée pour audit */
  sanitized: Record<string, unknown>;
}

export interface RefundInput {
  providerRef: string;
  amount: number;
  refundId: string;
  reason: string;
}

export interface RefundResult {
  providerRefundRef: string;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Vérifie la signature et l'horodatage puis décode l'événement. Lève une erreur si invalide. */
  parseWebhook(rawBody: string, headers: Headers): Promise<ProviderEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}
