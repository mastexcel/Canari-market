"use client";
/** Splash (logo animé) puis 3 écrans d'onboarding : le groupe → le volume → le prix → l'économie. */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FullLogo } from "@/ui/Logo";
import { buttonClasses } from "@/ui/Button";
import { cn } from "@/ui/cn";

const SLIDES = [
  { emoji: "👨‍👩‍👧‍👦", title: "Achetons ensemble", text: "Des centaines de ménages et petits commerces réunissent leurs besoins dans un même achat groupé." },
  { emoji: "📉", title: "Plus nous sommes nombreux, moins nous payons", text: "Le volume fait baisser le prix, palier après palier. Le prix que vous payez ne peut jamais monter." },
  { emoji: "🧺", title: "Juste la quantité qu'il vous faut", text: "Sesam-Market achète en gros et fractionne : 5 kg, 10 kg, 25 kg… Retrait au point relais ou livraison." },
];

function markOnboarded() {
  document.cookie = "sesam_onboarded=1; path=/; max-age=31536000; samesite=lax";
}

export function Onboarding({ images = [] }: { images?: Array<string | null> }) {
  const [splash, setSplash] = useState(true);
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  if (splash) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white px-6 text-center">
        <div className="animate-[pulse_1.4s_ease-in-out_infinite]">
          <FullLogo width={320} className="mx-auto h-auto w-[min(80vw,340px)]" />
        </div>
      </div>
    );
  }
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      <div className="flex justify-end">
        <Link href="/" onClick={markOnboarded} className="text-sm font-semibold text-anthracite-600">
          Passer
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center" aria-live="polite">
        {images[i] ? (
          <Image src={images[i]!} alt="" width={300} height={300} className="h-auto w-[min(72vw,300px)]" priority />
        ) : (
          <div className="grid size-40 place-items-center rounded-full bg-accent-100 text-7xl" aria-hidden>
            {s.emoji}
          </div>
        )}
        <h1 className="mt-8 text-2xl font-extrabold">{s.title}</h1>
        <p className="mt-3 max-w-xs text-anthracite-700">{s.text}</p>
      </div>
      <div className="mb-6 flex justify-center gap-2" aria-hidden>
        {SLIDES.map((_, k) => (
          <span key={k} className={cn("h-2 rounded-full transition-all", k === i ? "w-6 bg-brand-600" : "w-2 bg-gris-300")} />
        ))}
      </div>
      {last ? (
        <div className="space-y-2">
          <Link href="/inscription" onClick={markOnboarded} className={buttonClasses("primary", "lg", true)}>
            Créer mon compte
          </Link>
          <Link href="/connexion" onClick={markOnboarded} className={buttonClasses("outline", "lg", true)}>
            J&apos;ai déjà un compte
          </Link>
          <Link href="/" onClick={markOnboarded} className="block py-2 text-center text-sm font-semibold text-brand-700">
            Découvrir sans compte
          </Link>
        </div>
      ) : (
        <button onClick={() => setI(i + 1)} className={buttonClasses("primary", "lg", true)}>
          Suivant
        </button>
      )}
    </div>
  );
}
