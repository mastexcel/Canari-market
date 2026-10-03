import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]", className)} {...rest} />;
}

export function SectionTitle({ title, action, subtitle }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-anthracite-900">{title}</h2>
        {subtitle && <p className="text-sm text-anthracite-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {back}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-extrabold leading-tight text-anthracite-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-anthracite-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
