"use client";

export function QuantityStepper({ value, onChange, min = 1, max = 50, label }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="inline-flex items-center rounded-xl border border-gris-300 bg-white" role="group" aria-label={label}>
      <button type="button" className="grid size-10 place-items-center text-xl font-bold text-brand-700 disabled:text-gris-400" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label="Diminuer">
        −
      </button>
      <span className="tabular w-8 text-center font-bold" aria-live="polite">
        {value}
      </span>
      <button type="button" className="grid size-10 place-items-center text-xl font-bold text-brand-700 disabled:text-gris-400" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Augmenter">
        +
      </button>
    </div>
  );
}
