/**
 * app/(dashboard)/layout.tsx
 * Layout shared by all main nav routes:
 * Discover, Swap, Bridge, Launch, Watchlist.
 * Includes TopNav, ambient emerald glow backlights, and terminal footer.
 */

import { TopNav } from "@/components/ui/TopNav";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col min-h-dvh bg-bg text-text-primary overflow-x-hidden">
      {/* Ambient Neon Emerald Backlight Glows (Reference visual match) */}
      <div
        className="pointer-events-none fixed top-[-250px] left-[-200px] w-[700px] h-[700px] rounded-full opacity-15 blur-[140px]"
        style={{
          background: "radial-gradient(circle, rgba(59,178,115,0.8) 0%, rgba(59,178,115,0) 70%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed top-[-200px] right-[-250px] w-[800px] h-[800px] rounded-full opacity-12 blur-[160px]"
        style={{
          background: "radial-gradient(circle, rgba(59,178,115,0.7) 0%, rgba(59,178,115,0) 70%)",
        }}
        aria-hidden="true"
      />

      <TopNav />

      <main className="relative z-10 flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Global Terminal Footer (Matches Reference) */}
      <footer className="relative z-10 border-t border-border/70 bg-bg-card/40 backdrop-blur-sm mt-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          {/* Left: Copyright */}
          <div>
            <span>2026 © </span>
            <span className="font-semibold text-text-secondary tracking-wider">GLASSJAR</span>
            <span className="ml-2 text-[11px] text-text-muted">Cookie Chain DEX & Terminal</span>
          </div>

          {/* Center: Nav links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-text-secondary font-medium">
            <Link href="/" className="hover:text-accent transition-colors">
              Discover
            </Link>
            <Link href="/swap" className="hover:text-accent transition-colors">
              Swap
            </Link>
            <Link href="/bridge" className="hover:text-accent transition-colors">
              Bridge
            </Link>
            {/* <Link href="/launch" className="hover:text-accent transition-colors">
              Launchpad
            </Link> */}
            <Link href="/faucet" className="hover:text-accent transition-colors">
              Faucet
            </Link>
            <a
              href="https://docs.cookiechain.wtf"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Docs
            </a>
            <a
              href="https://cookiescan.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Explorer
            </a>
          </div>

          {/* Right: Social icons */}
          <div className="flex items-center gap-3 text-[15px] text-text-muted">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              title="X / Twitter"
            >
              <i className="ri-twitter-x-fill" />
            </a>
            <a
              href="https://t.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              title="Telegram"
            >
              <i className="ri-telegram-fill" />
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              title="Discord"
            >
              <i className="ri-discord-fill" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
              title="GitHub"
            >
              <i className="ri-github-fill" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
