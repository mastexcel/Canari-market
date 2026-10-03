const STEPS = [
  { emoji: "👥", title: "On s'unit", text: "Des centaines de ménages réservent leur part d'un même produit." },
  { emoji: "📦", title: "On achète en gros", text: "Sesam-Market négocie le prix de gros auprès des producteurs et grossistes." },
  { emoji: "⚖️", title: "On fractionne", text: "Les sacs sont partagés en portions : 5, 10, 25 kg… selon vos besoins." },
  { emoji: "💰", title: "Vous économisez", text: "Plus le groupe est grand, plus le prix baisse. Il ne peut jamais monter." },
];

export function HowItWorks() {
  return (
    <ol className="grid grid-cols-2 gap-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="rounded-[var(--radius-card)] bg-white p-3 shadow-[var(--shadow-card)]">
          <span className="text-2xl" aria-hidden>
            {s.emoji}
          </span>
          <p className="mt-1 text-sm font-bold">
            {i + 1}. {s.title}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-anthracite-600">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}
