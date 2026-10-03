import { requireUser } from "@/lib/session";
import { referralSummary } from "@/application/referral.service";
import { env } from "@/infrastructure/env";
import { DEFAULT_REFERRAL_CONFIG } from "@/domain/referral";
import { formatFcfa } from "@/domain/money";
import { formatShortDate } from "@/domain/dates";
import { Card, PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { Badge } from "@/ui/Badge";
import { ShareCode } from "./ShareCode";

export const metadata = { title: "Parrainage" };

export default async function ReferralPage() {
  const user = await requireUser("/compte/parrainage");
  const r = await referralSummary(user.id);
  const c = DEFAULT_REFERRAL_CONFIG;
  const link = `${env().APP_URL}/inscription?ref=${r.code}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Parrainage" back={<BackLink href="/compte" />} />
      <Card className="p-5 text-center">
        <p className="text-sm text-anthracite-600">Votre code</p>
        <p className="mt-1 text-3xl font-black tracking-widest text-brand-700">{r.code}</p>
        <ShareCode link={link} />
      </Card>
      <Card className="space-y-2 p-4 text-sm">
        <p className="font-bold">Comment ça marche</p>
        <p>
          Quand une personne invitée reçoit sa <strong>première commande</strong> (au moins {formatFcfa(c.minQualifyingOrderTotal)}), vous recevez chacun {formatFcfa(c.referrerReward)} d&apos;avoir.
        </p>
        <p className="text-xs text-anthracite-600">
          Un seul niveau : pas de gains sur les filleuls de vos filleuls. Les récompenses sont financées par les achats réels, plafonnées à {c.maxRewardsPerMonth} par mois.
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <p className="text-xs text-anthracite-600">Gagné</p>
          <p className="text-lg font-extrabold text-economie-700">{formatFcfa(r.rewarded)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-anthracite-600">En attente</p>
          <p className="text-lg font-extrabold">{r.pending}</p>
        </Card>
      </div>
      {r.referrals.length > 0 && (
        <Card className="divide-y divide-gris-200">
          {r.referrals.map((x) => (
            <div key={x.id} className="flex items-center justify-between p-3 text-sm">
              <span>
                {x.referee.firstName} · inscrit le {formatShortDate(x.referee.createdAt)}
              </span>
              <Badge tone={x.status === "REWARDED" ? "economie" : "neutral"}>{x.status === "REWARDED" ? "Récompensé" : "En attente"}</Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
