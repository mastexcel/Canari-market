import { NextResponse } from "next/server";
import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { clearSessionCookie } from "@/infrastructure/http/cookies";
import { deleteAccount } from "@/application/privacy.service";

export const POST = route({ auth: true, rateLimit: { limit: 5, windowMs: 3_600_000, key: "user" } }, async ({ req, user }) => {
  const { password } = await parseBody(req, z.object({ password: z.string().min(1).max(128), confirm: z.literal("SUPPRIMER") }));
  await deleteAccount(user!.id, password);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
