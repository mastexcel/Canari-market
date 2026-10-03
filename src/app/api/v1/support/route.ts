import { route, parseBody } from "@/infrastructure/http/handler";
import { supportTicketSchema } from "@/application/schemas";
import { createTicket } from "@/application/support.service";

export const POST = route({ auth: true, rateLimit: { limit: 5, windowMs: 3_600_000, key: "user" } }, async ({ req, user }) => {
  const t = await createTicket(user!.id, await parseBody(req, supportTicketSchema));
  return { ticket: { id: t.id } };
});
