"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE = "sesam_cookies";

/**
 * Bandeau d'information cookies. Le site n'utilise que des cookies strictement
 * nécessaires (session, préférences) : pas de consentement requis, mais une
 * information claire, avec lien vers le détail.
 */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`)));
  }, []);

  if (!visible) return null;

  const close = () => {
    document.cookie = `${COOKIE}=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setVisible(false);
  };

  return (
    // Dans le flux, en haut de page : ne recouvre jamais un bouton ou un formulaire.
    <div role="region" aria-label="Information cookies" className="bg-anthracite-900 text-white">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5 text-[13px] leading-snug">
        <p className="flex-1">
          🍪 Uniquement des cookies nécessaires (connexion, préférences), aucun traceur publicitaire.{" "}
          <Link href="/confidentialite#cookies" className="font-semibold text-accent-400 underline">
            En savoir plus
          </Link>
        </p>
        <button type="button" onClick={close} className="btn btn-accent h-9 shrink-0 px-3 text-sm font-bold">
          OK
        </button>
      </div>
    </div>
  );
}
