/**
 * Canaux de notification sortants. En l'absence de clé fournisseur, le
 * message est journalisé (jamais perdu silencieusement, jamais envoyé par erreur).
 */
import { logger } from "../logger";

export interface OutboundMessage {
  to: string; // téléphone E.164 ou e-mail
  title: string;
  body: string;
}

export interface NotificationChannelAdapter {
  readonly channel: "PUSH" | "SMS" | "WHATSAPP" | "EMAIL";
  send(msg: OutboundMessage): Promise<{ ok: boolean; error?: string }>;
}

class LogChannel implements NotificationChannelAdapter {
  constructor(readonly channel: NotificationChannelAdapter["channel"]) {}
  async send(msg: OutboundMessage) {
    logger.info("notification.simulated", { channel: this.channel, to: msg.to.replace(/\d(?=\d{4})/g, "•"), title: msg.title });
    return { ok: true };
  }
}

export function getChannelAdapter(channel: NotificationChannelAdapter["channel"]): NotificationChannelAdapter {
  // Les adaptateurs réels (passerelle SMS locale, API WhatsApp Business, e-mail)
  // se branchent ici en fonction des clés présentes dans l'environnement.
  return new LogChannel(channel);
}
