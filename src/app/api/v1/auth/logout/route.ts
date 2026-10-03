import { NextResponse } from "next/server";
import { route } from "@/infrastructure/http/handler";
import { clearSessionCookie } from "@/infrastructure/http/cookies";
import { logout, SESSION_COOKIE } from "@/application/auth.service";

export const POST = route({}, async ({ req }) => {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "");
  await logout(bearer ?? req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
