import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { joinCommunity } from "@/application/community.service";

export const POST = route<{ id: string }>({ auth: true, rateLimit: { limit: 20, windowMs: 60_000, key: "user" } }, async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ inviteCode: z.string().max(20).optional() }));
  await joinCommunity(user!.id, params.id, body.inviteCode ?? null);
  return { ok: true };
});
