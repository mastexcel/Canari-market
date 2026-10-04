import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] bg-white shadow-[var(--shadow-card)]", className)} {...rest} />;
}

export function SectionTitle({ title, action, subtitle, light = false, onOlive = false }: { title: string; subtitle?: string; action?: ReactNode; light?: boolean; onOlive?: boolean }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className={`flex items-center gap-2 text-lg font-bold ${light ? "text-white" : onOlive ? "text-anthracite-950" : "text-anthracite-900"}`}>
          <span aria-hidden className="h-5 w-1.5 rounded-full bg-gradient-to-b from-accent-400 to-accent-600" />
          {title}
        </h2>
        {subtitle && <p className={`text-sm ${light ? "text-white/85" : onOlive ? "font-medium text-anthracite-950" : "text-anthracite-600"}`}>{subtitle}</p>}
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
