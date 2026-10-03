import { route } from "@/infrastructure/http/handler";
import { listNotifications, markAllRead } from "@/application/notification.service";

export const GET = route({ auth: true }, async ({ user }) => ({ notifications: await listNotifications(user!.id) }));
export const POST = route({ auth: true }, async ({ user }) => {
  await markAllRead(user!.id);
  return { ok: true };
});
