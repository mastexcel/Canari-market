import { route, parseBody } from "@/infrastructure/http/handler";
import { checkoutSchema } from "@/application/schemas";
import { quoteCheckout } from "@/application/order.service";
import { track } from "@/application/analytics.service";

export const POST = route({ auth: true, rateLimit: { limit: 60, windowMs: 60_000, key: "user" } }, async ({ req, user }) => {
  const input = await parseBody(req, checkoutSchema);
  const q = await quoteCheckout(user!.id, input);
  await track("checkout_started", user!.id, { total: q.totals.total });
  return {
    totals: q.totals,
    fee: q.fee,
    readyAt: q.readyAt,
    slots: q.slots.map((s) => ({ start: s.start, end: s.end, label: s.label })),
    community: q.community ? { name: q.community.name, level: q.community.level.label } : null,
    creditAvailable: q.creditAvailable,
    hasGroupItems: q.hasGroupItems,
  };
});
