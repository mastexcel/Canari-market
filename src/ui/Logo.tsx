import Image from "next/image";
import { cn } from "./cn";

/** Emblème : le canari et son chariot (496 × 376). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.webp" alt="" width={Math.round((size * 496) / 376)} height={size} className={cn("object-contain", className)} priority />;
}

/** Nom de marque : « Sesam » vert forêt, tiret soleil, « Market » dégradé lime. */
export function Wordmark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("font-display text-[22px] leading-none font-bold tracking-[-0.02em] whitespace-nowrap", className)}>
      <span className={light ? "text-white" : "text-brand-700"}>Sesam</span>
      <span className="text-accent-500">-</span>
      <span className={light ? "text-lime-400" : "text-gradient-lime"}>Market</span>
    </span>
  );
}

/**
 * Logo horizontal officiel (emblème + nom, 732 × 198), version blanche sur fond foncé,
 * avec slogan optionnel (espaces pro, pied de page).
 */
export function Logo({ className, light = false, tagline = false, height = 40 }: { className?: string; light?: boolean; tagline?: boolean; height?: number }) {
  const ratio = light ? 732 / 166 : 732 / 198;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <Image src={light ? "/brand/logo-blanc.webp" : "/brand/logo-horizontal.webp"} alt="Sesam-Market" width={Math.round(height * ratio)} height={height} className="-my-0.5 h-auto w-auto" style={{ height }} priority />
      {tagline && <span className={cn("mt-0.5 pl-1 text-[10.5px] font-semibold tracking-wide", light ? "text-white/80" : "text-brand-700/80")}>À plusieurs, les prix s’ouvrent.</span>}
    </span>
  );
}

/** Logo complet officiel (emblème, nom, slogan). */
export function FullLogo({ className, width = 320 }: { className?: string; width?: number }) {
  return <Image src="/brand/logo-full.webp" alt="Sesam-Market — À plusieurs, les prix s’ouvrent." width={width} height={Math.round((width * 1024) / 1536)} className={className} priority />;
}
