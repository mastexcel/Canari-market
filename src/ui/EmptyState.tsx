import Image from "next/image";
import type { ReactNode } from "react";

export function EmptyState({ emoji = "🐤", image, title, children, action }: { emoji?: string; image?: string | null; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-gris-300 bg-white px-6 py-10 text-center">
      {image ? (
        <Image src={image} alt="" width={180} height={180} className="mb-3 h-auto w-40" />
      ) : (
        <span className="mb-3 text-5xl" aria-hidden>
          {emoji}
        </span>
      )}
      <p className="font-display text-lg font-bold text-anthracite-900">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-anthracite-600">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
