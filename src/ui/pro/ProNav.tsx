"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../cn";
import type { NavItem } from "./ProShell";

export function ProNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'espace" className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((it) => {
        const root = items[0].href;
        const active = it.href === root ? pathname === root : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold", active ? "bg-bordeaux-600 text-white" : "text-anthracite-700 hover:bg-gris-100")}
          >
            <span aria-hidden>{it.emoji}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
