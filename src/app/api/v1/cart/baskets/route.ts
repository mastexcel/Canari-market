import { z } from "zod";
import { route, parseBody } from "@/infrastructure/http/handler";
import { addBasketToCart, cartCount } from "@/application/cart.service";

export const POST = route({ auth: true }, async ({ req, user }) => {
  const { slug } = await parseBody(req, z.object({ slug: z.string().min(1).max(80) }));
  await addBasketToCart(user!.id, slug);
  return { ok: true, count: await cartCount(user!.id) };
});
