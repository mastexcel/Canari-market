import { NextResponse, type NextRequest } from "next/server";

/**
 * Première visite : on montre le splash + l'onboarding. La vraie vérification
 * des sessions et des rôles se fait côté serveur (layouts et API).
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/" && !req.cookies.has("canari_onboarded") && !req.cookies.has("canari_session")) {
    return NextResponse.redirect(new URL("/bienvenue", req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
