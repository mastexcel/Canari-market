import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { track } from "@/application/analytics.service";

export const POST = route({ auth: true, rateLimit: { limit: 30, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const { channel, groupBuyId } = await parseBody(req, z.object({ channel: z.enum(["whatsapp", "facebook", "link", "qr", "native"]), groupBuyId: z.string().max(40).optional() }));
  await track("referral_shared", user!.id, { channel, groupBuyId: groupBuyId ?? null });
  return { ok: true };
});
