import { route, parseBody } from "@/infrastructure/http/handler";
import { cartUpdateSchema } from "@/application/schemas";
import { cartCount, updateCartItem } from "@/application/cart.service";

export const PATCH = route<{ id: string }>({ auth: true }, async ({ req, user, params }) => {
  const { quantity } = await parseBody(req, cartUpdateSchema);
  await updateCartItem(user!.id, params.id, quantity);
  return { ok: true, count: await cartCount(user!.id) };
});

export const DELETE = route<{ id: string }>({ auth: true }, async ({ user, params }) => {
  await updateCartItem(user!.id, params.id, 0);
  return { ok: true, count: await cartCount(user!.id) };
});
