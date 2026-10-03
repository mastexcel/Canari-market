"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/Button";
import { Input, Select, Textarea } from "@/ui/Field";
import { Alert } from "@/ui/Alert";
import { useCommand } from "@/ui/pro/Command";

type Offer = { id: string; label: string; unitLabel: string; unitBase: number; cost: number };
type Product = { id: string; label: string; baseUnit: string; offers: Offer[] };

const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);
const section = "space-y-3 rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]";
const num = (v: string) => Math.round(Number(v.replace(/\s/g, "")) || 0);

export function NewGroupBuyForm({ products, communities }: { products: Product[]; communities: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const { send, busy, error } = useCommand("admin");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const [offerId, setOfferId] = useState("");
  const [f, setF] = useState({
    title: "",
    description: "",
    supplierUnitLabel: "Sac 50 kg",
    supplierUnitQuantityBase: "50000",
    targetUnits: "200",
    maxUnits: "500",
    referenceUnitPrice: "",
    referenceSource: "Relevé CANARI — marché d'Adjamé",
    referenceMethod: "Médiane de 3 relevés, même conditionnement",
    referenceObservedAt: day(0),
    opensAt: day(0),
    closesAt: day(10),
    expectedDeliveryAt: day(15),
    failurePolicy: "REFUND",
    extensionDays: "3",
    maxExtensions: "1",
    alternativeUnitPrice: "",
    supplierUnitCost: "",
    inboundTransportPerUnit: "0",
    storagePerUnit: "0",
    fractionationFeePerPortion: "150",
    fractionationCostPerPortion: "60",
    packagingCostPerPortion: "40",
    lossRateBps: "100",
    paymentFeeBps: "150",
    deliveryCostPerOrder: "50",
    promotionCostPerUnit: "0",
    expectedAvgPortionBase: "10000",
    communityId: "",
  });
  const [tiers, setTiers] = useState([{ minUnits: "50", unitPrice: "" }, { minUnits: "200", unitPrice: "" }]);
  const [portions, setPortions] = useState([{ label: "5 kg", quantityBase: "5000" }, { label: "10 kg", quantityBase: "10000" }, { label: "50 kg", quantityBase: "50000" }]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function chooseOffer(id: string) {
    setOfferId(id);
    const o = product?.offers.find((x) => x.id === id);
    if (o) setF({ ...f, supplierUnitLabel: o.unitLabel, supplierUnitQuantityBase: String(o.unitBase), supplierUnitCost: o.cost ? String(o.cost) : f.supplierUnitCost });
  }

  async function submit() {
    const res = await send<{ groupBuy: { id: string } }>({
      type: "groupbuy.create",
      data: {
        title: f.title,
        description: f.description,
        productId,
        supplierProductId: offerId || undefined,
        communityId: f.communityId || undefined,
        supplierUnitLabel: f.supplierUnitLabel,
        supplierUnitQuantityBase: num(f.supplierUnitQuantityBase),
        targetUnits: num(f.targetUnits),
        maxUnits: num(f.maxUnits),
        referenceUnitPrice: num(f.referenceUnitPrice),
        referenceSource: f.referenceSource,
        referenceMethod: f.referenceMethod,
        referenceObservedAt: `${f.referenceObservedAt}T12:00:00Z`,
        opensAt: `${f.opensAt}T00:00:00Z`,
        closesAt: `${f.closesAt}T20:00:00Z`,
        expectedDeliveryAt: `${f.expectedDeliveryAt}T12:00:00Z`,
        failurePolicy: f.failurePolicy,
        extensionDays: num(f.extensionDays),
        maxExtensions: num(f.maxExtensions),
        alternativeUnitPrice: f.alternativeUnitPrice ? num(f.alternativeUnitPrice) : undefined,
        supplierUnitCost: num(f.supplierUnitCost),
        inboundTransportPerUnit: num(f.inboundTransportPerUnit),
        storagePerUnit: num(f.storagePerUnit),
        fractionationFeePerPortion: num(f.fractionationFeePerPortion),
        fractionationCostPerPortion: num(f.fractionationCostPerPortion),
        packagingCostPerPortion: num(f.packagingCostPerPortion),
        lossRateBps: num(f.lossRateBps),
        paymentFeeBps: num(f.paymentFeeBps),
        deliveryCostPerOrder: num(f.deliveryCostPerOrder),
        promotionCostPerUnit: num(f.promotionCostPerUnit),
        expectedAvgPortionBase: num(f.expectedAvgPortionBase),
        tiers: tiers.map((t) => ({ minUnits: num(t.minUnits), unitPrice: num(t.unitPrice) })),
        portions: portions.map((p) => ({ label: p.label, quantityBase: num(p.quantityBase) })),
      },
    });
    if (res) router.push(`/admin/achats-groupes/${res.groupBuy.id}`);
  }

  return (
    <div className="space-y-4">
      <div className={section}>
        <p className="font-bold">Produit & fournisseur</p>
        <Select label="Produit" value={productId} onChange={(e) => { setProductId(e.target.value); setOfferId(""); }}>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
        <Select label="Offre fournisseur de référence" optional value={offerId} onChange={(e) => chooseOffer(e.target.value)} hint="Sert à pré-remplir l'unité et le coût. Le fournisseur final est choisi par RFQ.">
          <option value="">Aucune</option>
          {product?.offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        <Input label="Titre" value={f.title} onChange={set("title")} placeholder="Riz parfumé — sac de 50 kg" />
        <Textarea label="Description" value={f.description} onChange={set("description")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Unité fournisseur" value={f.supplierUnitLabel} onChange={set("supplierUnitLabel")} />
          <Input label={`Contenu (${product?.baseUnit === "GRAM" ? "g" : product?.baseUnit === "MILLILITER" ? "mL" : "pièces"})`} inputMode="numeric" value={f.supplierUnitQuantityBase} onChange={set("supplierUnitQuantityBase")} />
          <Input label="Objectif (unités)" inputMode="numeric" value={f.targetUnits} onChange={set("targetUnits")} />
          <Input label="Capacité max (unités)" inputMode="numeric" value={f.maxUnits} onChange={set("maxUnits")} />
        </div>
        <Select label="Réservé à une communauté" optional value={f.communityId} onChange={set("communityId")}>
          <option value="">Ouvert à tous</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className={section}>
        <p className="font-bold">Prix de référence (daté et sourcé)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Prix marché par unité fournisseur (F)" inputMode="numeric" value={f.referenceUnitPrice} onChange={set("referenceUnitPrice")} />
          <Input label="Date du relevé" type="date" value={f.referenceObservedAt} onChange={set("referenceObservedAt")} hint="Plus de 30 jours : publication bloquée." />
          <Input label="Source" value={f.referenceSource} onChange={set("referenceSource")} />
          <Input label="Méthode" value={f.referenceMethod} onChange={set("referenceMethod")} />
        </div>
      </div>

      <div className={section}>
        <p className="font-bold">Paliers de prix client (par unité fournisseur)</p>
        {tiers.map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Input label="À partir de (unités)" inputMode="numeric" value={t.minUnits} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, minUnits: e.target.value } : x)))} />
            <Input label="Prix (F)" inputMode="numeric" value={t.unitPrice} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, unitPrice: e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} disabled={tiers.length === 1} aria-label="Retirer le palier">
              ✕
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setTiers([...tiers, { minUnits: "", unitPrice: "" }])}>
          + Palier
        </Button>
      </div>

      <div className={section}>
        <p className="font-bold">Portions proposées aux ménages</p>
        {portions.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Input label="Libellé" value={p.label} onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <Input label="Quantité (unité de base)" inputMode="numeric" value={p.quantityBase} onChange={(e) => setPortions(portions.map((x, j) => (j === i ? { ...x, quantityBase: e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => setPortions(portions.filter((_, j) => j !== i))} disabled={portions.length === 1} aria-label="Retirer la portion">
              ✕
            </Button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setPortions([...portions, { label: "", quantityBase: "" }])}>
          + Portion
        </Button>
        <Input label="Portion moyenne attendue (pour les projections)" inputMode="numeric" value={f.expectedAvgPortionBase} onChange={set("expectedAvgPortionBase")} />
      </div>

      <div className={section}>
        <p className="font-bold">Calendrier & règle si le seuil n&apos;est pas atteint</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Ouverture" type="date" value={f.opensAt} onChange={set("opensAt")} />
          <Input label="Date limite" type="date" value={f.closesAt} onChange={set("closesAt")} />
          <Input label="Livraison prévue" type="date" value={f.expectedDeliveryAt} onChange={set("expectedDeliveryAt")} />
        </div>
        <Select label="Règle d'échec (affichée avant paiement)" value={f.failurePolicy} onChange={set("failurePolicy")}>
          <option value="REFUND">Remboursement intégral</option>
          <option value="EXTEND">Prolongation puis remboursement</option>
          <option value="ALTERNATIVE_PRICE">Prix alternatif (accord du client requis)</option>
          <option value="CREDIT_WITH_CONSENT">Avoir, uniquement si le client l&apos;a choisi</option>
        </Select>
        {f.failurePolicy === "EXTEND" && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jours de prolongation" inputMode="numeric" value={f.extensionDays} onChange={set("extensionDays")} />
            <Input label="Nombre max" inputMode="numeric" value={f.maxExtensions} onChange={set("maxExtensions")} />
          </div>
        )}
        {f.failurePolicy === "ALTERNATIVE_PRICE" && <Input label="Prix alternatif par unité (F)" inputMode="numeric" value={f.alternativeUnitPrice} onChange={set("alternativeUnitPrice")} />}
      </div>

      <div className={section}>
        <p className="font-bold">Économie unitaire (F par unité fournisseur, sauf mention)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Prix fournisseur" inputMode="numeric" value={f.supplierUnitCost} onChange={set("supplierUnitCost")} />
          <Input label="Transport amont" inputMode="numeric" value={f.inboundTransportPerUnit} onChange={set("inboundTransportPerUnit")} />
          <Input label="Stockage" inputMode="numeric" value={f.storagePerUnit} onChange={set("storagePerUnit")} />
          <Input label="Frais client de fractionnement / portion" inputMode="numeric" value={f.fractionationFeePerPortion} onChange={set("fractionationFeePerPortion")} />
          <Input label="Coût fractionnement / portion" inputMode="numeric" value={f.fractionationCostPerPortion} onChange={set("fractionationCostPerPortion")} />
          <Input label="Emballage / portion" inputMode="numeric" value={f.packagingCostPerPortion} onChange={set("packagingCostPerPortion")} />
          <Input label="Pertes (bps)" inputMode="numeric" value={f.lossRateBps} onChange={set("lossRateBps")} hint="100 bps = 1 %" />
          <Input label="Frais de paiement (bps)" inputMode="numeric" value={f.paymentFeeBps} onChange={set("paymentFeeBps")} />
          <Input label="Coût livraison net / commande" inputMode="numeric" value={f.deliveryCostPerOrder} onChange={set("deliveryCostPerOrder")} />
          <Input label="Promotions / unité" inputMode="numeric" value={f.promotionCostPerUnit} onChange={set("promotionCostPerUnit")} />
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <Button size="lg" loading={busy} onClick={submit}>
        Créer le brouillon et évaluer
      </Button>
    </div>
  );
}
