import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white p-4 shadow-[var(--shadow-card)]" aria-busy="true" aria-label="Chargement">
      <Skeleton className="mb-3 h-5 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mb-2 h-3", i % 2 ? "w-1/2" : "w-5/6")} />
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-1/2" />
      <CardSkeleton />
      <CardSkeleton lines={4} />
      <CardSkeleton lines={2} />
    </div>
  );
}
