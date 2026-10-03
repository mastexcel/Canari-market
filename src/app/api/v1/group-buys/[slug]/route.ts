import { route } from "@/infrastructure/http/handler";
import { getGroupBuyDetail } from "@/application/group-buy.service";

export const GET = route<{ slug: string }>({}, async ({ user, params }) => ({ groupBuy: await getGroupBuyDetail(params.slug, user?.id ?? null) }));
