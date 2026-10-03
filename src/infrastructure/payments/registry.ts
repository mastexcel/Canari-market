import { env } from "../env";
import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./provider";

/**
 * Registre des prestataires. Pour brancher un prestataire réel (CinetPay,
 * Wave, Orange Money…), implémenter PaymentProvider et l'ajouter ici.
 */
export function getPaymentProvider(name?: string): PaymentProvider {
  const selected = name ?? env().PAYMENT_PROVIDER;
  switch (selected) {
    case "mock":
      if (env().NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
        throw new Error("Le prestataire simulé est désactivé en production.");
      }
      return new MockPaymentProvider(env().PAYMENT_WEBHOOK_SECRET);
    default:
      throw new Error(`Prestataire de paiement inconnu : ${selected}`);
  }
}

export function getMockProvider(): MockPaymentProvider {
  return getPaymentProvider("mock") as MockPaymentProvider;
}
