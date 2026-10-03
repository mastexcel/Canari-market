import { NextResponse } from "next/server";
import { route } from "@/infrastructure/http/handler";
import { exportUserData } from "@/application/privacy.service";

export const GET = route({ auth: true, rateLimit: { limit: 5, windowMs: 3_600_000, key: "user" } }, async ({ user }) => {
  const data = await exportUserData(user!.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="sesam-market-mes-donnees.json"`, "cache-control": "no-store" },
  });
});
