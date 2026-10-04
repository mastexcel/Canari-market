"use client";
/**
 * Affiches de campagne : 2 visibles à la fois en portrait, 4 en paysage ou sur grand
 * écran. Aucune affiche n'est coupée : le carrousel avance d'une « page » entière.
 * Défilement automatique (sauf si l'utilisateur préfère réduire les animations),
 * suspendu au survol ou au focus.
 */
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "../cn";

export type Pub = { src: string; alt: string; href: string };

export function PubCarousel({ pubs }: { pubs: Pub[] }) {
  const [perView, setPerView] = useState(2);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);
  const pages = Math.max(1, Math.ceil(pubs.length / perView));

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px), (orientation: landscape) and (min-width: 600px)");
    const update = () => setPerView(mq.matches ? 4 : 2);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => setPage((p) => Math.min(p, pages - 1)), [pages]);

  useEffect(() => {
    if (paused || pages < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setPage((p) => (p + 1) % pages), 6000);
    return () => clearInterval(t);
  }, [paused, pages]);

  const go = (p: number) => setPage((p + pages) % pages);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="overflow-hidden rounded-[var(--radius-card)]">
        <ul className="flex transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ transform: `translateX(-${page * 100}%)` }}>
          {pubs.map((p, i) => {
            const visible = Math.floor(i / perView) === page;
            return (
              <li key={p.src} className="shrink-0 px-1.5" style={{ flexBasis: `${100 / perView}%` }} aria-hidden={!visible}>
                <Link href={p.href} tabIndex={visible ? undefined : -1} className="block overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] ring-2 ring-white transition-transform hover:-translate-y-0.5">
                  <Image src={p.src} alt={p.alt} width={662} height={1200} sizes="(min-width: 768px) 25vw, 50vw" className="aspect-[331/631] w-full bg-[#f4f7e8] object-contain" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" onClick={() => go(page - 1)} aria-label="Affiches précédentes" className="grid size-9 place-items-center rounded-full bg-white font-bold text-brand-800 shadow-[var(--shadow-card)]">
            ‹
          </button>
          <div className="flex gap-0.5">
            {Array.from({ length: pages }, (_, k) => (
              <button key={k} type="button" onClick={() => go(k)} aria-label={`Affiches ${k + 1} sur ${pages}`} aria-current={k === page ? "true" : undefined} className="grid h-6 min-w-6 place-items-center">
                <span className={cn("h-2.5 rounded-full shadow-sm transition-all", k === page ? "w-7 bg-accent-500" : "w-2.5 bg-white")} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(page + 1)} aria-label="Affiches suivantes" className="grid size-9 place-items-center rounded-full bg-white font-bold text-brand-800 shadow-[var(--shadow-card)]">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
