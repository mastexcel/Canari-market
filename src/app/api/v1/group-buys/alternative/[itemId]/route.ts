import { route } from "@/infrastructure/http/handler";
import { declineAlternative } from "@/application/group-buy.service";

/** Refus du prix alternatif → remboursement intégral. (L'acceptation passe par POST /payments, purpose=SUPPLEMENT.) */
export const POST = route<{ itemId: string }>({ auth: true }, async ({ user, params }) => {
  await declineAlternative(user!.id, params.itemId);
  return { ok: true };
});
