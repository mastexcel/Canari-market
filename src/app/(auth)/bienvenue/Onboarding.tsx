"use client";
/**
 * Page de garde : splash coloré, puis 3 écrans qui racontent la promesse
 * (le groupe → le prix qui baisse → la bonne quantité près de chez soi),
 * appuyés par les vrais chiffres de la plateforme.
 */
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { FullLogo } from "@/ui/Logo";
import { buttonClasses } from "@/ui/Button";
import { cn } from "@/ui/cn";
import { formatFcfa } from "@/domain/money";

type Stats = { households: number; total: number; openGroupBuys: number; pickupPoints: number } | null;

type Slide = {
  eyebrow: string;
  title: ReactNode;
  text: string;
  emoji: string;
  ring: string; // couleur des anneaux « soleil »
  glow: string; // halo derrière l'illustration
  proof: (s: NonNullable<Stats>) => string | null;
};

const Hl = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("relative whitespace-nowrap", className)}>{children}</span>;

const SLIDES: Slide[] = [
  {
    eyebrow: "Achats groupés",
    title: (
      <>
        Ensemble, on achète <Hl className="text-accent-400">comme les grossistes</Hl>
      </>
    ),
    text: "Ménages et petits commerces d’Abidjan réunissent leurs besoins dans un même achat : riz, huile, savon, cahiers…",
    emoji: "👨‍👩‍👧‍👦",
    ring: "#FF9A3D",
    glow: "from-accent-200 via-accent-100 to-lime-100",
    proof: (s) => (s.households ? `👥 ${s.households.toLocaleString("fr-FR")} ménages ont déjà acheté ensemble` : null),
  },
  {
    eyebrow: "Prix qui baisse",
    title: (
      <>
        Plus on est nombreux, <Hl className="text-accent-400">plus le prix baisse</Hl>
      </>
    ),
    text: "Chaque participant rapproche le groupe du palier suivant. Votre prix ne peut jamais monter : la différence vous est remboursée.",
    emoji: "📉",
    ring: "#7D8C22",
    glow: "from-lime-100 via-brand-100 to-lagune-100",
    proof: (s) => (s.total ? `💰 ${formatFcfa(s.total)} déjà économisés ensemble` : null),
  },
  {
    eyebrow: "Près de chez vous",
    title: (
      <>
        Juste ce qu’il vous faut, <Hl className="text-accent-400">dans votre quartier</Hl>
      </>
    ),
    text: "Le sac de 50 kg est partagé en 5, 10 ou 25 kg. Retrait au point relais du quartier ou livraison à domicile.",
    emoji: "🧺",
    ring: "#E86C00",
    glow: "from-terre-100 via-accent-100 to-lagune-100",
    proof: (s) => (s.pickupPoints ? `📍 ${s.pickupPoints} points relais · ${s.openGroupBuys} achats groupés ouverts` : null),
  },
];

function markOnboarded() {
  document.cookie = "sesam_onboarded=1; path=/; max-age=31536000; samesite=lax";
}

/** Formes décoratives flottantes (feuille wax, losange, soleil, points). */
function Shapes({ color }: { color: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <svg className="animate-float absolute -top-2 left-1 size-10" viewBox="0 0 40 40">
        <path d="M20 2C32 12 32 28 20 38C8 28 8 12 20 2Z" fill="#7D8C22" opacity=".85" />
        <path d="M20 6V34" stroke="#535F13" strokeWidth="2" />
      </svg>
      <svg className="animate-float absolute top-6 -right-1 size-8 [animation-delay:-1.5s]" viewBox="0 0 32 32">
        <path d="M16 1L31 16 16 31 1 16Z" fill={color} opacity=".9" />
        <path d="M16 9L23 16 16 23 9 16Z" fill="#fff" opacity=".9" />
      </svg>
      <svg className="animate-float absolute bottom-3 -left-2 size-9 [animation-delay:-3s]" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="none" stroke="#262F33" strokeWidth="4" />
        <circle cx="18" cy="18" r="6" fill="#FF9A3D" />
      </svg>
      <svg className="animate-float absolute right-2 bottom-0 size-9 [animation-delay:-2.2s]" viewBox="0 0 36 36">
        {[6, 18, 30].map((x) => (
          <circle key={x} cx={x} cy="10" r="4" fill="#E86C00" />
        ))}
        {[12, 24].map((x) => (
          <circle key={x} cx={x} cy="21" r="4" fill="#E86C00" />
        ))}
        <circle cx="18" cy="32" r="4" fill="#E86C00" />
      </svg>
    </div>
  );
}

export function Onboarding({ images = [], stats = null }: { images?: Array<string | null>; stats?: Stats }) {
  const [splash, setSplash] = useState(true);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  if (splash) {
    return (
      <div className="fond-accueil fixed inset-0 z-50 flex flex-col">
        <div className="kente-band" />
        <div className="relative grid flex-1 place-items-center px-6 text-center">
          <svg aria-hidden className="animate-spin-slow absolute size-[min(110vw,520px)] opacity-60" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="96" fill="none" stroke="#FF9A3D" strokeWidth="3" strokeDasharray="2 10" />
            <circle cx="100" cy="100" r="80" fill="none" stroke="#7D8C22" strokeWidth="3" strokeDasharray="14 8" />
            <circle cx="100" cy="100" r="64" fill="none" stroke="#E86C00" strokeWidth="2" strokeDasharray="4 6" />
          </svg>
          <div className="animate-rise relative">
            <FullLogo halo width={340} className="mx-auto w-[min(80vw,340px)]" />
          </div>
        </div>
        <div className="kente-band" />
      </div>
    );
  }

  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  const proof = stats ? s.proof(stats) : null;
  return (
    <div className="-mx-4 -my-6 flex min-h-dvh flex-col text-white" data-fond="accueil">
      <div className="kente-band" />
      <div className="flex flex-1 flex-col px-5 pt-3 pb-5">
        <div className="flex items-center justify-between">
          <span className="capsule-soleil rounded-full px-3 py-1 text-xs font-extrabold tracking-wide uppercase shadow-[var(--shadow-card)]">
            {i + 1}/{SLIDES.length} · {s.eyebrow}
          </span>
          <Link href="/" onClick={markOnboarded} className="sur-fond rounded-full px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15">
            Passer
          </Link>
        </div>

        <div key={i} className="flex flex-1 flex-col items-center justify-center text-center paysage-court:flex-row paysage-court:gap-8 paysage-court:text-left" aria-live="polite">
          {/* Illustration dans un « soleil » : halo, anneaux et formes wax */}
          <div className="animate-rise relative mt-3 size-[min(76vw,310px,38dvh)] shrink-0 paysage-court:mt-0 paysage-court:size-[min(62dvh,260px)]">
            <div className={cn("absolute inset-3 rounded-full bg-gradient-to-br", s.glow)} />
            <svg aria-hidden className="animate-spin-slow absolute inset-0 size-full" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="97" fill="none" stroke={s.ring} strokeWidth="3" strokeDasharray="3 9" strokeLinecap="round" />
              <circle cx="100" cy="100" r="90" fill="none" stroke="#535F13" strokeOpacity=".25" strokeWidth="1.5" />
            </svg>
            <div className="absolute inset-[9%] overflow-hidden rounded-full bg-white shadow-[0_18px_40px_-18px_rgb(6_56_33/0.45)] ring-4 ring-white">
              {images[i] ? (
                <Image src={images[i]!} alt="" fill sizes="320px" className="object-contain p-2" priority />
              ) : (
                <span className="grid size-full place-items-center text-7xl" aria-hidden>
                  {s.emoji}
                </span>
              )}
            </div>
            <Shapes color={s.ring} />
          </div>

          <div className="mt-5 px-4 py-1 paysage-court:mt-0 paysage-court:px-0">
            <h1 className="sur-fond animate-rise max-w-sm text-[28px] leading-[1.12] font-extrabold text-white [animation-delay:80ms]">{s.title}</h1>
            <p className="sur-fond animate-rise mx-auto mt-3 max-w-xs paysage-court:mx-0 paysage-court:max-w-md text-[15px] leading-relaxed font-medium text-white [animation-delay:140ms]">{s.text}</p>
          </div>
          {proof && <p className="animate-rise mt-3 rounded-full paysage-court:hidden bg-white px-4 py-2 text-sm font-bold text-anthracite-900 shadow-[var(--shadow-card)] [animation-delay:200ms]">{proof}</p>}
        </div>

        <div className="my-5 flex justify-center gap-2 paysage-court:my-3" aria-hidden>
          {SLIDES.map((_, k) => (
            <span key={k} className={cn("h-2.5 rounded-full transition-all", k === i ? "w-8 bg-accent-700" : "w-2.5 bg-white/80")} />
          ))}
        </div>

        {last ? (
          <div className="space-y-2.5">
            <Link href="/inscription" onClick={markOnboarded} className={buttonClasses("accent", "lg", true)}>
              Rejoindre gratuitement
            </Link>
            <Link href="/connexion" onClick={markOnboarded} className={buttonClasses("secondary", "lg", true)}>
              J&apos;ai déjà un compte
            </Link>
            <Link href="/" onClick={markOnboarded} className="sur-fond block py-1.5 text-center text-sm font-bold text-white underline underline-offset-2">
              Découvrir les achats groupés sans compte
            </Link>
          </div>
        ) : (
          <button
            onClick={() => {
              setI(i + 1);
              window.scrollTo({ top: 0 });
            }}
            className={buttonClasses("accent", "lg", true)}
          >
            Suivant
          </button>
        )}
      </div>
      <div className="kente-band" />
    </div>
  );
}
