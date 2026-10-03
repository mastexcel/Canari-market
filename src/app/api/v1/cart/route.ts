import { route } from "@/infrastructure/http/handler";
import { getCart } from "@/application/cart.service";

export const GET = route({ auth: true }, async ({ user }) => getCart(user!.id));
