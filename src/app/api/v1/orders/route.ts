import { route, parseBody } from "@/infrastructure/http/handler";
import { checkoutSchema } from "@/application/schemas";
import { listOrders, placeOrder } from "@/application/order.service";
import { canPurchase } from "@/domain/permissions";
import { DomainError } from "@/domain/errors";

export const GET = route({ auth: true }, async ({ user }) => ({ orders: await listOrders(user!.id) }));

export const POST = route({ auth: true, rateLimit: { limit: 10, windowMs: 60_000, key: "user" } }, async ({ req, user, idempotencyKey }) => {
  if (!canPurchase(user)) throw new DomainError("FORBIDDEN", "Ce type de compte ne peut pas passer commande.");
  const order = await placeOrder(user!.id, await parseBody(req, checkoutSchema), idempotencyKey);
  return { order: { id: order.id, number: order.number, total: order.total, status: order.status } };
});
