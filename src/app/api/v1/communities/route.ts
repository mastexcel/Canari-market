import { route, parseBody } from "@/infrastructure/http/handler";
import { communitySchema } from "@/application/schemas";
import { createCommunity, listCommunities } from "@/application/community.service";

export const GET = route({}, async ({ req, user }) => ({
  communities: await listCommunities({ commune: user?.commune, q: req.nextUrl.searchParams.get("q") ?? undefined }),
}));

export const POST = route({ auth: true, roles: ["HOUSEHOLD", "MERCHANT", "ADMIN"], rateLimit: { limit: 5, windowMs: 3_600_000, key: "user" } }, async ({ req, user }) => {
  const c = await createCommunity(user!.id, await parseBody(req, communitySchema));
  return { community: { id: c.id, slug: c.slug } };
});
