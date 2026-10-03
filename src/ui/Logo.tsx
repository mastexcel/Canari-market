import Image from "next/image";
import { cn } from "./cn";

/** Emblème : le chariot garni et ses ailes (400 × 299). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.webp" alt="" width={Math.round((size * 400) / 299)} height={size} className={cn("object-contain", className)} priority />;
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
 * Logo horizontal officiel (emblème + nom, 760 × 221), version blanche (420 × 203) sur fond foncé,
 * avec slogan optionnel (espaces pro, pied de page).
 */
export function Logo({ className, light = false, tagline = false, height = 44 }: { className?: string; light?: boolean; tagline?: boolean; height?: number }) {
  const ratio = light ? 420 / 203 : 760 / 221;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <Image src={light ? "/brand/logo-blanc.webp" : "/brand/logo-horizontal.webp"} alt="Sesam-Market" width={Math.round(height * ratio)} height={height} className="-my-0.5 h-auto w-auto" style={{ height }} priority />
      {tagline && <span className={cn("mt-0.5 pl-1 text-[10.5px] font-semibold tracking-wide", light ? "text-white/80" : "text-brand-700/80")}>À plusieurs, les prix s’ouvrent.</span>}
    </span>
  );
}

/** Logo complet : logo horizontal et slogan (accueil, connexion, inscription). */
export function FullLogo({ className, width = 320 }: { className?: string; width?: number }) {
  return (
    <span className={cn("flex flex-col items-center", className)}>
      <Image src="/brand/logo-horizontal.webp" alt="Sesam-Market" width={width} height={Math.round((width * 221) / 760)} className="h-auto w-full" priority />
      <span className="mt-1 font-display text-sm font-semibold tracking-wide text-brand-700">
        À plusieurs, <span className="text-lime-600">les prix s’ouvrent.</span>
      </span>
    </span>
  );
}
