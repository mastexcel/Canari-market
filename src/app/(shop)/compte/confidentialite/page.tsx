import { requireUser } from "@/lib/session";
import { currentConsents } from "@/application/privacy.service";
import { formatDateTime } from "@/domain/dates";
import { Card, PageHeader } from "@/ui/Card";
import { BackLink } from "@/ui/shop/BackLink";
import { PrivacyControls } from "./PrivacyControls";

export const metadata = { title: "Confidentialité" };

const LABELS: Record<string, string> = { TERMS: "Conditions d'utilisation", PRIVACY: "Politique de confidentialité", MARKETING_SMS: "Offres par SMS", MARKETING_WHATSAPP: "Offres par WhatsApp", ANALYTICS: "Mesure d'audience" };

export default async function PrivacyPage() {
  const user = await requireUser("/compte/confidentialite");
  const c = await currentConsents(user.id);
  const granted = (t: string) => (c.latest as Record<string, { granted: boolean } | undefined>)[t]?.granted ?? false;
  return (
    <div className="space-y-4">
      <PageHeader title="Confidentialité" back={<BackLink href="/compte" />} />
      <Card className="space-y-2 p-4 text-sm text-anthracite-700">
        <p className="font-bold text-anthracite-900">Nos engagements</p>
        <p>Nous collectons uniquement ce qui sert à vos commandes : prénom, téléphone, quartier, adresse de livraison. Aucune donnée bancaire n&apos;est stockée par Sesam-Market.</p>
        <p>Vos achats individuels ne sont jamais vendus. Les analyses partagées avec des partenaires sont agrégées et anonymisées.</p>
        <p>Conservation : données de compte tant que le compte est actif ; pièces comptables 10 ans (obligation légale), détachées de votre identité après suppression du compte.</p>
      </Card>
      <PrivacyControls initial={{ MARKETING_SMS: granted("MARKETING_SMS"), MARKETING_WHATSAPP: granted("MARKETING_WHATSAPP"), ANALYTICS: granted("ANALYTICS") }} />
      <Card className="p-4">
        <p className="mb-2 font-bold">Journal des consentements</p>
        <ul className="space-y-1 text-xs text-anthracite-700">
          {c.history.slice(0, 20).map((h) => (
            <li key={h.id}>
              {formatDateTime(h.createdAt)} — {LABELS[h.type]} : {h.granted ? "accepté" : "refusé"} (v{h.version})
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
