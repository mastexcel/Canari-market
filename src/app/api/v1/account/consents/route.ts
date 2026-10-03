import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { setConsent } from "@/application/privacy.service";

export const POST = route({ auth: true }, async ({ req, user, ip }) => {
  const { type, granted } = await parseBody(req, z.object({ type: z.enum(["MARKETING_SMS", "MARKETING_WHATSAPP", "ANALYTICS", "TERMS", "PRIVACY"]), granted: z.boolean() }));
  await setConsent(user!.id, type, granted, ip);
  return { ok: true };
});
