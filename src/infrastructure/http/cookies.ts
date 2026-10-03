import type { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS } from "@/application/auth.service";
import { env } from "../env";

/** Secure dès que l'application est servie en HTTPS (toujours le cas en production). */
const secure = () => env().APP_URL.startsWith("https://");

/** Cookie de session : httpOnly, SameSite=Lax, Secure en production. */
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secure(),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: secure(), path: "/", maxAge: 0 });
}
