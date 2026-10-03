"use client";
import { useState } from "react";
import { api, ApiError } from "@/ui/api-client";
import { Button } from "@/ui/Button";
import { Checkbox, ChoiceCard, Input, Select } from "@/ui/Field";
import { Alert } from "@/ui/Alert";

export function SignupForm({ communes, referralCode, next }: { communes: string[]; referralCode: string; next: string | null }) {
  const [f, setF] = useState({
    accountType: "HOUSEHOLD",
    firstName: "",
    lastName: "",
    businessName: "",
    phone: "",
    password: "",
    commune: "",
    quartier: "",
    adults: "2",
    children: "0",
    referralCode,
    acceptTerms: false,
    marketingSms: false,
    marketingWhatsapp: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className="mt-6 space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        setErrors({});
        try {
          const r = await api<{ redirect: string }>("/auth/signup", {
            body: { ...f, adults: Number(f.adults), children: Number(f.children), businessName: f.businessName || undefined, commune: f.commune || undefined },
          });
          document.cookie = "sesam_onboarded=1; path=/; max-age=31536000; samesite=lax";
          // Navigation complète : repart d'un cache client vierge avec la nouvelle session.
          window.location.assign(next ?? r.redirect);
        } catch (err) {
          if (err instanceof ApiError) {
            const issues = (err.details as Array<{ path: string; message: string }> | undefined) ?? [];
            if (issues.length) setErrors(Object.fromEntries(issues.map((i) => [i.path, i.message])));
            setError(err.message);
          } else setError("Erreur");
          setBusy(false);
        }
      }}
    >
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de compte">
        <ChoiceCard name="type" value="HOUSEHOLD" checked={f.accountType === "HOUSEHOLD"} onChange={(v) => setF({ ...f, accountType: v })} title="🏠 Ménage" />
        <ChoiceCard name="type" value="MERCHANT" checked={f.accountType === "MERCHANT"} onChange={(v) => setF({ ...f, accountType: v })} title="🏪 Commerce" />
      </div>
      <Input label="Prénom" autoComplete="given-name" value={f.firstName} onChange={set("firstName")} error={errors.firstName} />
      <Input label="Nom" optional autoComplete="family-name" value={f.lastName} onChange={set("lastName")} />
      {f.accountType === "MERCHANT" && <Input label="Nom du commerce" value={f.businessName} onChange={set("businessName")} />}
      <Input label="Téléphone" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} placeholder="07 07 12 34 56" error={errors.phone} hint="Il sert à vous connecter et à recevoir vos codes de retrait." />
      <Input label="Mot de passe" type="password" autoComplete="new-password" value={f.password} onChange={set("password")} error={errors.password} hint="8 caractères minimum, avec au moins une lettre et un chiffre." />
      <Select label="Commune" value={f.commune} onChange={set("commune")} error={errors.commune}>
        <option value="">Choisir…</option>
        {communes.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Input label="Quartier" value={f.quartier} onChange={set("quartier")} placeholder="Ex. Angré 8e Tranche" error={errors.quartier} />
      {f.accountType === "HOUSEHOLD" && (
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-1.5 text-sm font-semibold">Votre ménage (approximatif)</legend>
          <Select label="Adultes" value={f.adults} onChange={set("adults")}>
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
          <Select label="Enfants" value={f.children} onChange={set("children")}>
            {[0, 1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </Select>
        </fieldset>
      )}
      <Input label="Code de parrainage" optional value={f.referralCode} onChange={(e) => setF({ ...f, referralCode: e.target.value.toUpperCase() })} />
      <div className="space-y-1 rounded-xl bg-white p-3">
        <Checkbox label={<>J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité.</>} checked={f.acceptTerms} onChange={(e) => setF({ ...f, acceptTerms: e.target.checked })} />
        {errors.acceptTerms && <p className="text-sm text-alerte-700">{errors.acceptTerms}</p>}
        <Checkbox label="Recevoir les bons plans par SMS" description="Facultatif, modifiable à tout moment." checked={f.marketingSms} onChange={(e) => setF({ ...f, marketingSms: e.target.checked })} />
        <Checkbox label="Recevoir les bons plans par WhatsApp" checked={f.marketingWhatsapp} onChange={(e) => setF({ ...f, marketingWhatsapp: e.target.checked })} />
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" block size="lg" loading={busy}>
        Créer mon compte
      </Button>
    </form>
  );
}
