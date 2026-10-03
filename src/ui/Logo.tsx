import { cn } from "./cn";

/** Le canari : oiseau stylisé, jaune/orangé, sur pastille bordeaux. */
export function CanariMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="CANARI" className={className}>
      <circle cx="24" cy="24" r="24" fill="#8e1b3a" />
      <path d="M12 30c0-7 5.5-12 12.5-12 3 0 5.4.9 7.2 2.4l4.8-1.6-2.6 4.3c.7 1.4 1.1 3 1.1 4.9 0 6.4-5.4 10-12 10-6.9 0-11-3.3-11-8z" fill="#f5a524" />
      <path d="M17 29.5c3.5 0 7.5 1.5 9.5 4.5-4.5.8-9-.6-11.5-3.6.5-.6 1.2-.9 2-.9z" fill="#db8a0b" />
      <circle cx="30.5" cy="24" r="1.6" fill="#1f2023" />
      <path d="M36.6 25.2l5.4 1.3-5.4 1.7z" fill="#f8ba4d" />
      <path d="M18 38.5h12" stroke="#fde3b0" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <CanariMark size={34} />
      <span className={cn("text-xl font-black tracking-wide", light ? "text-white" : "text-bordeaux-700")}>CANARI</span>
    </span>
  );
}
