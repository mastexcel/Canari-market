import { route, parseBody } from "@/infrastructure/http/handler";
import { reviewSchema } from "@/application/schemas";
import { createReview } from "@/application/support.service";

export const POST = route({ auth: true, rateLimit: { limit: 20, windowMs: 3_600_000, key: "user" } }, async ({ req, user }) => {
  await createReview(user!.id, await parseBody(req, reviewSchema));
  return { ok: true };
});
