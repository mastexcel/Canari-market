import { route } from "@/infrastructure/http/handler";
import { listOpenGroupBuys } from "@/application/group-buy.service";

export const GET = route({}, async ({ req }) => ({
  groupBuys: await listOpenGroupBuys({ categorySlug: req.nextUrl.searchParams.get("categorie") ?? undefined }),
}));
