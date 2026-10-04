import Image from "next/image";
import { cn } from "./cn";

/** Emblème : le chariot garni et ses feuilles (420 × 292). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.webp" alt="" width={Math.round((size * 420) / 292)} height={size} className={cn("object-contain", className)} priority />;
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
 * Logo horizontal officiel (900 × 259) et sa version pour fond sombre (900 × 198, « Sesam » en blanc),
 * avec slogan optionnel (espaces pro, pied de page).
 */
export function Logo({ className, light = false, tagline = false, height = 48 }: { className?: string; light?: boolean; tagline?: boolean; height?: number }) {
  const ratio = light ? 900 / 198 : 900 / 259;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      <Image src={light ? "/brand/logo-sombre.webp" : "/brand/logo-horizontal.webp"} alt="Sesam-Market" width={Math.round(height * ratio)} height={height} className="-my-0.5 h-auto w-auto" style={{ height }} priority />
      {tagline && <span className={cn("mt-0.5 pl-1 text-xs font-semibold", light ? "text-white" : "text-brand-700")}>À plusieurs, les prix s’ouvrent.</span>}
    </span>
  );
}

/** Logo complet : version empilée (chariot au-dessus du nom) et slogan — accueil, connexion, inscription. */
export function FullLogo({ className, width = 320, light = false, halo = false }: { className?: string; width?: number; light?: boolean; halo?: boolean }) {
  return (
    <span className={cn("flex flex-col items-center", halo && "halo-logo", className)}>
      {light ? (
        <Image src="/brand/logo-sombre.webp" alt="Sesam-Market" width={width} height={Math.round((width * 198) / 900)} className="h-auto w-full" priority />
      ) : (
        <Image src="/brand/logo-empile.webp" alt="Sesam-Market" width={width} height={Math.round((width * 367) / 640)} className="h-auto w-full" priority />
      )}
      <span className={cn("mt-2 font-display text-sm font-semibold tracking-wide", light ? "text-white" : "text-anthracite-800")}>
        À plusieurs, <span className={light ? "text-accent-400" : "text-accent-700"}>les prix s’ouvrent.</span>
      </span>
    </span>
  );
}
