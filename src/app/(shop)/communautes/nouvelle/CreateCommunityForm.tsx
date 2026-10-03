"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/ui/Field";
import { Alert } from "@/ui/Alert";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export function CreateCommunityForm({ communes, points, defaultCommune }: { communes: string[]; points: Array<{ id: string; name: string; commune: string }>; defaultCommune: string }) {
  const [f, setF] = useState({ name: "", type: "NEIGHBORHOOD", commune: defaultCommune, quartier: "", description: "", pickupPointId: "", deliveryWeekday: "6", isPublic: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const r = await api<{ community: { slug: string } }>("/communities", {
            body: { ...f, quartier: f.quartier || undefined, description: f.description || undefined, pickupPointId: f.pickupPointId || undefined, deliveryWeekday: Number(f.deliveryWeekday) },
          });
          router.push(`/communautes/${r.community.slug}`);
        } catch (err) {
          setError(err instanceof ApiError ? err.message : "Erreur");
          setBusy(false);
        }
      }}
    >
      <Input label="Nom" required value={f.name} onChange={set("name")} placeholder="Ex. Angré 8e Tranche" hint="« CANARI » sera ajouté automatiquement." />
      <Select label="Type" value={f.type} onChange={set("type")}>
        <option value="NEIGHBORHOOD">Quartier</option>
        <option value="RESIDENCE">Résidence</option>
        <option value="COMPANY">Entreprise</option>
        <option value="ASSOCIATION">Association</option>
        <option value="OTHER">Autre</option>
      </Select>
      <Select label="Commune" value={f.commune} onChange={set("commune")}>
        {communes.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Input label="Quartier" optional value={f.quartier} onChange={set("quartier")} />
      <Select label="Point relais de la communauté" optional value={f.pickupPointId} onChange={set("pickupPointId")}>
        <option value="">Aucun pour l&apos;instant</option>
        {points.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.commune})
          </option>
        ))}
      </Select>
      <Select label="Jour de livraison souhaité" value={f.deliveryWeekday} onChange={set("deliveryWeekday")}>
        {DAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </Select>
      <Textarea label="Description" optional value={f.description} onChange={set("description")} maxLength={400} />
      <Checkbox label="Communauté publique" description="Sinon, un code d'invitation est nécessaire pour rejoindre." checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block size="lg" loading={busy}>
        Créer la communauté
      </Button>
    </form>
  );
}
