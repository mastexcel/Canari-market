"use client";
/**
 * Histogramme mono-série : une teinte, barres fines arrondies côté données,
 * espacement de 2 px, info-bulle au survol/focus, vue tableau accessible.
 * Deux mesures d'échelles différentes = deux graphiques (jamais de double axe).
 */
import { useState } from "react";
import { formatFcfa } from "@/domain/money";

export function BarChart({
  data,
  color = "var(--color-brand-600)",
  kind = "fcfa",
  label,
}: {
  data: Array<{ key: string; label: string; value: number }>;
  color?: string;
  /** Les fonctions ne traversent pas la frontière serveur → client : on passe un type de format. */
  kind?: "fcfa" | "count";
  label: string;
}) {
  const format = (v: number) => (kind === "fcfa" ? formatFcfa(v) : new Intl.NumberFormat("fr-FR").format(v));
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const h = 140;
  return (
    <figure className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]">
      <figcaption className="mb-3 flex items-center justify-between gap-2">
        <span className="font-bold">{label}</span>
        <button className="text-xs font-semibold text-brand-700 underline" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? "Graphique" : "Tableau"}
        </button>
      </figcaption>
      {table ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-anthracite-600">
                <th scope="col" className="py-1">Date</th>
                <th scope="col" className="py-1 text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-gris-200">
                  <td className="py-1">{d.label}</td>
                  <td className="py-1 text-right tabular">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-end gap-[2px] border-b border-gris-300" style={{ height: h }} role="group" aria-label={`${label} : maximum ${format(max)}`}>
            {data.map((d, i) => (
              <button
                key={d.key}
                type="button"
                className="group flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label} : ${format(d.value)}`}
              >
                <span
                  className="w-full rounded-t-[4px] transition-opacity"
                  style={{ height: `${d.value ? Math.max(2, (d.value / max) * 100) : 0}%`, background: color, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
              </button>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-anthracite-500">
            <span>{data[0]?.label}</span>
            <span>{data.at(-1)?.label}</span>
          </div>
          {hover !== null && data[hover] && (
            <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 rounded-lg bg-anthracite-900 px-2.5 py-1.5 text-xs text-white shadow-[var(--shadow-float)]">
              {data[hover].label} · <strong className="tabular">{format(data[hover].value)}</strong>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
