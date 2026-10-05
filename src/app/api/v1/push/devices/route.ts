import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { pushDeviceSchema, registerPushDevice, unregisterPushDevice } from "@/application/push.service";

/** Abonne l'appareil courant aux notifications push de l'utilisateur connecté. */
export const POST = route({ auth: true, rateLimit: { limit: 20, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const device = await registerPushDevice(user!.id, await parseBody(req, pushDeviceSchema), req.headers.get("user-agent"));
  return { device: { id: device.id, kind: device.kind } };
});

/** Désabonne l'appareil courant. */
export const DELETE = route({ auth: true }, async ({ req, user }) => {
  const { endpoint } = await parseBody(req, z.object({ endpoint: z.string().min(20).max(4096) }));
  return { removed: await unregisterPushDevice(user!.id, endpoint) };
});
