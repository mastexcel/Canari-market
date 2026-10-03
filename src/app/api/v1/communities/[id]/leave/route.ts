import { route } from "@/infrastructure/http/handler";
import { leaveCommunity } from "@/application/community.service";

export const POST = route<{ id: string }>({ auth: true }, async ({ user, params }) => {
  await leaveCommunity(user!.id, params.id);
  return { ok: true };
});
