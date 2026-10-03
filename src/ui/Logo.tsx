import Image from "next/image";
import { cn } from "./cn";

/** Emblème : le canari et son chariot (extrait du logo officiel). */
export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/mark.webp" alt="" width={Math.round(size * 1.49)} height={size} className={cn("object-contain", className)} priority />;
}

/** Nom de marque : « Sesam » vert forêt, tiret soleil, « Market » dégradé lime. */
export function Wordmark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("text-xl leading-none font-black tracking-tight whitespace-nowrap", className)}>
      <span className={light ? "text-white" : "text-brand-700"}>Sesam</span>
      <span className="text-accent-500">-</span>
      <span className={light ? "text-lime-400" : "text-gradient-lime"}>Market</span>
    </span>
  );
}

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-label="Sesam-Market">
      <BrandMark size={30} />
      <Wordmark light={light} />
    </span>
  );
}

/** Logo complet officiel (emblème, nom, slogan). */
export function FullLogo({ className, width = 320 }: { className?: string; width?: number }) {
  return <Image src="/brand/logo-full.webp" alt="Sesam-Market — À plusieurs, les prix s’ouvrent." width={width} height={Math.round((width * 1024) / 1536)} className={className} priority />;
}
