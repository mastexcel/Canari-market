import { route } from "@/infrastructure/http/handler";
import { cancelOrder } from "@/application/order.service";

export const POST = route<{ id: string }>({ auth: true, rateLimit: { limit: 10, windowMs: 60_000, key: "user" } }, async ({ user, params }) => cancelOrder(user!.id, params.id));
