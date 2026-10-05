import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import { publicAsset } from "@/infrastructure/assets";
import { PageHeader } from "@/ui/Card";
import { ButtonLink, buttonClasses } from "@/ui/Button";

export const metadata = {
  title: "Application mobile",
  description: "Téléchargez l'application Sesam-Market pour Android, ou installez-la sur iPhone depuis Safari.",
};

/** Version publiée par la compilation automatique (public/downloads/version.json). */
function androidBuild() {
  const apk = publicAsset("downloads/sesam-market.apk");
  if (!apk) return null;
  const dir = path.join(process.cwd(), "public/downloads");
  let version = "";
  try {
    version = JSON.parse(readFileSync(path.join(dir, "version.json"), "utf8")).version ?? "";
  } catch {}
  const mo = (statSync(path.join(dir, "sesam-market.apk")).size / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  return { apk, version, mo };
}

export default function ApplicationPage() {
  const android = androidBuild();
  return (
    <div className="space-y-4">
      <PageHeader title="L’application Sesam-Market" subtitle="Vos achats groupés dans la poche, en portrait comme en paysage." />

      <section className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] bg-white p-5 text-center shadow-[var(--shadow-card)] md:flex-row md:text-left">
        <Image src="/icons/icon-192.png" alt="" width={96} height={96} className="size-24 rounded-[1.6rem] shadow-[var(--shadow-card)]" />
        <div className="flex-1">
          <h2 className="text-lg font-bold text-anthracite-900">Android</h2>
          {android ? (
            <>
              <p className="mt-1 text-sm text-anthracite-700">
                Version {android.version || "1.0"} · {android.mo} Mo · Android 7 ou plus récent
              </p>
              <a href={android.apk} download="sesam-market.apk" className={`${buttonClasses("accent", "lg")} mt-3`}>
                Télécharger pour Android
              </a>
            </>
          ) : (
            <p className="mt-1 text-sm text-anthracite-700">Bientôt disponible au téléchargement.</p>
          )}
        </div>
      </section>

      {android && (
        <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-bold text-anthracite-900">Installer sur Android</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-anthracite-800">
            <li>Touchez « Télécharger pour Android », puis ouvrez le fichier téléchargé.</li>
            <li>Si le téléphone le demande, autorisez l’installation depuis votre navigateur (Paramètres → Installer des applis inconnues).</li>
            <li>Touchez « Installer » : l’icône Sesam-Market apparaît sur votre écran d’accueil.</li>
          </ol>
          <p className="mt-3 text-xs text-anthracite-600">L’application arrivera bientôt sur Google Play ; elle se mettra alors à jour automatiquement.</p>
        </section>
      )}

      <section className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-bold text-anthracite-900">iPhone et iPad</h2>
        <p className="mt-1 text-sm text-anthracite-700">L’application arrive bientôt sur l’App Store. En attendant, installez Sesam-Market en un geste :</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-anthracite-800">
          <li>Ouvrez sesam-market.onrender.com dans Safari.</li>
          <li>Touchez le bouton Partager, puis « Sur l’écran d’accueil ».</li>
        </ol>
      </section>

      <ButtonLink href="/achats-groupes" variant="secondary" block>
        Continuer sur le site
      </ButtonLink>
    </div>
  );
}
