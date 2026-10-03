import { NextResponse } from "next/server";
import { route, parseBody } from "@/infrastructure/http/handler";
import { setSessionCookie } from "@/infrastructure/http/cookies";
import { loginSchema } from "@/application/schemas";
import { createSession, login } from "@/application/auth.service";
import { homePathFor } from "@/domain/permissions";

export const POST = route({ rateLimit: { limit: 10, windowMs: 15 * 60_000 } }, async ({ req, ip }) => {
  const { phone, password } = await parseBody(req, loginSchema);
  const user = await login(phone, password);
  const session = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  // Le jeton est aussi renvoyé pour les clients mobiles (en-tête Authorization: Bearer).
  const res = NextResponse.json({ user, token: session.token, redirect: homePathFor(user.role) });
  setSessionCookie(res, session.token);
  return res;
});
