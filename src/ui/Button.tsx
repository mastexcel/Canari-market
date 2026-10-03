import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "accent" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-bordeaux-600 text-white hover:bg-bordeaux-700 active:bg-bordeaux-800 disabled:bg-gris-300 disabled:text-anthracite-500",
  secondary: "bg-white text-bordeaux-700 border border-bordeaux-200 hover:bg-bordeaux-50 disabled:text-anthracite-500",
  accent: "bg-canari-500 text-anthracite-900 hover:bg-canari-400 active:bg-canari-600 disabled:bg-gris-300",
  ghost: "bg-transparent text-anthracite-800 hover:bg-gris-200",
  outline: "bg-transparent border border-gris-300 text-anthracite-800 hover:bg-white",
  danger: "bg-alerte-700 text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-13 px-5 text-base rounded-xl",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", block = false) {
  return cn(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors select-none disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    block && "w-full",
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", block, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={cn(buttonClasses(variant, size, block), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonClasses(variant, size, block), className)}>
      {children}
    </Link>
  );
}
