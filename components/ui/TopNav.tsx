"use client";

/**
 * components/ui/TopNav.tsx
 * High-density trading-terminal top navigation.
 * Matches Traderly reference: Centered nav pill cluster, Cookie Chain status pill,
 * bold emerald connect button, notification icon, profile drawer access.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// ssr:false — wallet-adapter reads window on mount
const ConnectButton = dynamic(
  () => import("@/components/wallet/ConnectButton").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-9 w-36 rounded-full bg-bg-card border border-border animate-pulse" />
    ),
  }
);

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/swap", label: "Swap" },
  { href: "/bridge", label: "Bridge" },
  // { href: "/launch", label: "Launch" }, // Commented out — re-enable in future iteration
  { href: "/watchlist", label: "Watchlist" },
] as const;

export function TopNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090b10]/75 backdrop-blur-2xl">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/logo.png" alt="GlassJar" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-wider text-text-primary uppercase font-sans">
              GlassJar
            </span>
          </div>
        </Link>

        {/* Center: Nav Capsule Container */}
        <nav
          className="hidden md:flex items-center gap-1 p-1 glass-pill rounded-full"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative h-8 px-4 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 select-none flex items-center justify-center",
                  active
                    ? "bg-accent text-[#08090C] shadow-[0_0_14px_rgba(59,178,115,0.45)] font-bold"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.06]"
                )}
              >
                <span className="relative z-10">{label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Network badge + Wallet + Actions */}
        <div className="flex items-center gap-2.5">
          {/* Chain Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 h-9 rounded-full glass-pill text-xs text-text-secondary select-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="font-medium text-text-primary">Cookie Chain</span>
          </div>

          {/* Connect Wallet */}
          <ConnectButton />

          {/* Quick Explorer Icon */}
          <a
            href="https://cookiescan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex h-9 w-9 rounded-full items-center justify-center glass-pill text-text-secondary hover:text-accent hover:border-accent/40 transition-colors"
            title="Open CookieScan Explorer"
          >
            <i className="ri-external-link-line text-[15px]" />
          </a>

          {/* Profile / Account drawer */}
          <Link
            href="/profile"
            className={cn(
              "hidden sm:flex h-9 w-9 rounded-full items-center justify-center bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors",
              pathname === "/profile" && "text-accent border-accent/40 bg-accent/10"
            )}
            title="Portfolio & Activity"
          >
            <i className="ri-user-3-line text-[15px]" />
          </Link>
        </div>
      </div>
    </header>
  );
}
