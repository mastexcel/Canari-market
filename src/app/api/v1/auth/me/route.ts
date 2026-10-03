import { route } from "@/infrastructure/http/handler";

export const GET = route({ auth: true }, async ({ user }) => ({ user }));
