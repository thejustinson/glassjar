"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/", label: "Discover", icon: "ri-compass-3-line", activeIcon: "ri-compass-3-fill" },
  { href: "/swap", label: "Swap", icon: "ri-swap-line", activeIcon: "ri-swap-fill" },
  { href: "/bridge", label: "Bridge", icon: "ri-shuffle-line", activeIcon: "ri-shuffle-fill" },
  { href: "/watchlist", label: "Watchlist", icon: "ri-star-line", activeIcon: "ri-star-fill" },
  { href: "/profile", label: "Portfolio", icon: "ri-user-3-line", activeIcon: "ri-user-3-fill" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 max-w-md mx-auto z-40 md:hidden flex items-center justify-around py-1.5 px-2 rounded-full glass-panel border border-white/[0.14] shadow-[0_8px_32px_rgba(0,0,0,0.7)] backdrop-blur-2xl select-none"
      aria-label="Mobile Navigation"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2.5 rounded-full transition-all duration-200 cursor-pointer min-w-[54px]",
              active
                ? "text-accent font-bold"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <i className={cn("text-lg", active ? item.activeIcon : item.icon)} />
            <span className="text-[10px] tracking-tight leading-tight mt-0.5 font-medium">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
