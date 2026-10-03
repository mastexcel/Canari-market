import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { currentUser } from "@/lib/session";
import { getGroupBuyDetail } from "@/application/group-buy.service";
import { DomainError } from "@/domain/errors";
import { formatFcfa } from "@/domain/money";
import { formatUnits, unitNoun } from "@/domain/units";
import { formatDate, timeLeft } from "@/domain/dates";
import { env } from "@/infrastructure/env";
import { Card } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { Alert } from "@/ui/Alert";
import { ProductTile } from "@/ui/ProductTile";
import { GroupProgress } from "@/ui/ProgressBar";
import { BackLink } from "@/ui/shop/BackLink";
import { tierMarkers } from "@/ui/shop/GroupBuyCard";
import { JoinPanel } from "./JoinPanel";
import { SharePanel } from "./SharePanel";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const gb = await getGroupBuyDetail((await params).slug, null);
    return { title: gb.title, description: `Achat groupé : ${formatFcfa(gb.progress.targetUnitPrice)} au lieu de ${formatFcfa(gb.referenceUnitPrice)}.` };
  } catch {
    return { title: "Achat groupé" };
  }
}

export default async function GroupBuyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await currentUser();
  let gb;
  try {
    gb = await getGroupBuyDetail(slug, user?.id ?? null);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  const now = new Date();
  const p = gb.progress;
  const unit = gb.supplierUnitLabel.toLowerCase();
  const open = gb.status === "OPEN" && gb.closesAt > now;
  const shareUrl = `${env().APP_URL}/achats-groupes/${gb.slug}${user ? `?ref=${user.referralCode}` : ""}`;
  const qrSvg = await QRCode.toString(shareUrl, { type: "svg", margin: 1, color: { dark: "#0e5f36", light: "#ffffff" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackLink href="/achats-groupes" />
        <Badge tone={open ? "economie" : "neutral"}>{open ? `Ouvert · clôture ${timeLeft(gb.closesAt, now)}` : "Clôturé"}</Badge>
      </div>

      <ProductTile emoji={gb.product.emoji} name={gb.product.name} src={gb.image} size="lg" />
      <div>
        <h1 className="text-[26px] leading-tight font-bold">{gb.title}</h1>
        <p className="mt-1 text-sm text-anthracite-600">{gb.description}</p>
      </div>

      {/* Le groupe → le volume → le prix → l'économie */}
      <section className="capsule-foret rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)]">
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-white/90">Prix marché indicatif</dt>
            <dd className="text-lg font-bold tabular text-white/90">
              <span className={gb.referenceIsFresh ? "line-through" : ""}>{formatFcfa(gb.referenceUnitPrice)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-white/90">Prix Sesam-Market à l&apos;objectif</dt>
            <dd>
              <span className="inline-block rounded-lg bg-white px-2 py-0.5 text-xl font-extrabold tabular text-brand-800">{formatFcfa(p.targetUnitPrice)}</span>
            </dd>
          </div>
        </dl>
        {gb.targetSavingPerUnit ? (
          <p className="capsule-soleil mt-3 rounded-xl px-3 py-2 text-center font-extrabold">
            Économie : {formatFcfa(gb.targetSavingPerUnit)} par {unit}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-white/90">
          {gb.referenceIsFresh ? "Référence" : "⚠️ Référence ancienne (économie non affichée)"} : {gb.referenceSource} — {gb.referenceMethod}, relevé du {formatDate(gb.referenceObservedAt)}.
        </p>
      </section>

      <Card className="p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-anthracite-700">Progression</p>
          <p className="rounded-xl bg-brand-700 px-2.5 py-0.5 text-2xl font-extrabold tabular text-white">{Math.floor(p.percentOfTarget * 10) / 10} %</p>
        </div>
        <p className="mb-2 text-xl font-extrabold tabular">
          {formatUnits(p.committedUnits, 0)} / {gb.targetUnits} <span className="text-base font-semibold text-anthracite-600">{unitNoun(gb.supplierUnitLabel, gb.targetUnits)}</span>
        </p>
        <GroupProgress percent={p.percentOfTarget} markers={tierMarkers(gb)} size="lg" label="Progression vers l'objectif" />
        <p className="mt-3 text-center text-base font-bold text-anthracite-900">
          {p.remainingToTargetUnits > 0 ? `Plus que ${p.remainingToTargetUnits} ${unitNoun(gb.supplierUnitLabel, p.remainingToTargetUnits)} équivalents pour débloquer ce prix.` : "Objectif atteint : le meilleur prix est débloqué 🎉"}
        </p>
        <p className="mt-1 text-center text-xs text-anthracite-600">{gb.participantCount} participations confirmées</p>

        <h2 className="mt-4 mb-2 text-sm font-bold">Paliers de prix</h2>
        <ol className="space-y-1.5">
          {[...gb.tiers].sort((a, b) => a.minUnits - b.minUnits).map((t) => {
            const reached = p.committedUnits >= t.minUnits;
            const isNext = p.nextTier?.minUnits === t.minUnits;
            return (
              <li key={t.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${reached ? "bg-economie-50 font-semibold" : isNext ? "bg-accent-100" : "bg-gris-50"}`}>
                <span>
                  {reached ? "✅" : isNext ? "🎯" : "⬜"} {t.minUnits} {unitNoun(gb.supplierUnitLabel, t.minUnits)}
                </span>
                <span className="tabular font-bold">{formatFcfa(t.unitPrice)}</span>
              </li>
            );
          })}
        </ol>
        {p.nextTier && p.nextTierExtraSavingPerUnit ? (
          <Alert tone="warning" className="mt-3">
            <strong>Prix actuel : {formatFcfa(p.payableUnitPrice)}</strong> · prochain prix : {formatFcfa(p.nextTier.unitPrice)}.<br />
            Encore {p.remainingToNextTierUnits} {unitNoun(gb.supplierUnitLabel, p.remainingToNextTierUnits ?? 0)} (≈ {gb.estimatedOrdersToNextTier} commandes) pour économiser {formatFcfa(p.nextTierExtraSavingPerUnit)} supplémentaires par {unit}.
          </Alert>
        ) : null}
      </Card>

      <Card className="p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-anthracite-600">Date limite</dt>
            <dd className="text-right font-semibold">{formatDate(gb.closesAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-anthracite-600">Livraison prévue</dt>
            <dd className="text-right font-semibold">{formatDate(gb.expectedDeliveryAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-anthracite-600">Places restantes</dt>
            <dd className="text-right font-semibold">
              {formatUnits(p.availableUnits, 0)} {unitNoun(gb.supplierUnitLabel, p.availableUnits)}
            </dd>
          </div>
        </dl>
        <div className="mt-3 rounded-xl bg-gris-50 p-3">
          <p className="font-bold">Si le seuil n&apos;est pas atteint</p>
          <p className="mt-1 text-anthracite-700">{gb.failurePolicyText}</p>
          <p className="mt-2 font-bold">Garantie Sesam-Market</p>
          <p className="mt-1 text-anthracite-700">Vous payez le prix actuel. Si un meilleur palier est atteint à la clôture, la différence vous est remboursée. Le prix ne peut jamais augmenter.</p>
        </div>
      </Card>

      {open ? (
        <JoinPanel
          loggedIn={!!user}
          slug={gb.slug}
          unitLabel={unit}
          failurePolicy={gb.failurePolicy}
          myQuantityBase={gb.myQuantityBase}
          baseUnit={gb.product.baseUnit}
          portions={gb.portions.map((x) => ({ id: x.id, label: x.label, quantityBase: x.quantityBase, unitPrice: x.unitPrice, fee: x.fractionationFee, reference: x.reference, saving: x.saving, targetPrice: x.targetPrice }))}
          full={p.isFull}
        />
      ) : (
        <Alert tone="info" title="Cet achat groupé est clôturé">
          Retrouvez les achats en cours dans l&apos;onglet Achats groupés.
        </Alert>
      )}

      <SharePanel url={shareUrl} title={gb.title} groupBuyId={gb.id} qrSvg={qrSvg} remaining={p.remainingToTargetUnits} unit={unitNoun(gb.supplierUnitLabel, p.remainingToTargetUnits)} loggedIn={!!user} />
    </div>
  );
}
