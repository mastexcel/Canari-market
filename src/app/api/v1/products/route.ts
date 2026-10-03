import { route } from "@/infrastructure/http/handler";
import { searchProducts } from "@/application/catalog.service";

export const GET = route({ rateLimit: { limit: 120, windowMs: 60_000 } }, async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  return { products: await searchProducts({ q: sp.get("q")?.slice(0, 60) ?? undefined, categorySlug: sp.get("categorie") ?? undefined, take: 40 }) };
});
