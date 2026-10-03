import { NextResponse } from "next/server";
import { route, parseBody } from "@/infrastructure/http/handler";
import { setSessionCookie } from "@/infrastructure/http/cookies";
import { signupSchema } from "@/application/schemas";
import { createSession, signup } from "@/application/auth.service";
import { homePathFor } from "@/domain/permissions";

export const POST = route({ rateLimit: { limit: 5, windowMs: 15 * 60_000 } }, async ({ req, ip }) => {
  const input = await parseBody(req, signupSchema);
  const user = await signup(input, { ip });
  const session = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  const res = NextResponse.json({ user, token: session.token, redirect: homePathFor(user.role) });
  setSessionCookie(res, session.token);
  return res;
});
