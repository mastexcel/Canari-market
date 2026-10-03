import type { ReactNode } from "react";

export function EmptyState({ emoji = "🐤", title, children, action }: { emoji?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-gris-300 bg-white px-6 py-10 text-center">
      <span className="mb-3 text-5xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-lg font-bold text-anthracite-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-anthracite-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
