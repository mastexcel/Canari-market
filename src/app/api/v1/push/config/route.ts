import { route } from "@/infrastructure/http/handler";
import { pushConfigured, vapidPublicKey } from "@/infrastructure/notifications/push";

/** Clé publique Web Push et disponibilité des canaux (aucune donnée sensible). */
export const GET = route({}, async ({ user }) => ({
  authenticated: Boolean(user),
  vapidPublicKey: vapidPublicKey(),
  channels: pushConfigured(),
}));
