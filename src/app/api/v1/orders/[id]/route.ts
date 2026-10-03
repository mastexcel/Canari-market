import { route } from "@/infrastructure/http/handler";
import { getOrderForUser } from "@/application/order.service";

export const GET = route<{ id: string }>({ auth: true }, async ({ user, params }) => ({ order: await getOrderForUser(user!.id, params.id) }));
