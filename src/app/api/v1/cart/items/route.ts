import { route, parseBody } from "@/infrastructure/http/handler";
import { cartItemSchema } from "@/application/schemas";
import { addToCart, cartCount } from "@/application/cart.service";
import { canPurchase } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";

export const POST = route({ auth: true, rateLimit: { limit: 60, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  if (!canPurchase(user)) throw new DomainError("FORBIDDEN", "Ce type de compte ne peut pas passer commande.");
  await addToCart(user!.id, await parseBody(req, cartItemSchema));
  return { ok: true, count: await cartCount(user!.id) };
});
