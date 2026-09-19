"use client";

/**
 * app/(dashboard)/page.tsx — Discover
 * Modern, spacious trading-terminal layout inspired by the Quantix reference.
 * Features:
 * - Top pair ticker tape
 * - 3-Card Live Crypto Updates hero spotlight with SVG area charts
 * - Filter pills (All, Trending, Favorites, Top Gainers, Top Losers)
 * - Market Overview table with mini trend sparklines
 * - Docked Quick Exchange terminal with live on-chain swap execution
 * - Ecosystem pulse & activity telemetry
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { getTopTokens, getCookPrice, type Token } from "@/lib/das";
import { TokenSearchModal } from "@/components/search/TokenSearchModal";
import {
  useWatchlist,
  formatPrice,
  formatPct,
  formatNumber,
  deltaColorClass,
  truncateAddress,
  copyToClipboard,
} from "@/lib";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/tokens";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { MarketTickerTape } from "@/components/discover/MarketTickerTape";
import { LiveHighlights } from "@/components/discover/LiveHighlights";
import { MiniSparkline } from "@/components/discover/MiniSparkline";
import { EcosystemPulse } from "@/components/discover/EcosystemPulse";
import { SwapCard } from "@/components/swap/SwapCard";

// ─── Table Types & Header ─────────────────────────────────────────────────────

type SortKey = "price" | "priceChange24h" | "volume24h" | "marketCap" | "liquidity" | "holderCount";
type FilterTab = "all" | "favorites" | "gainers" | "losers";

const COLS = "44px minmax(180px, 1.8fr) 110px 95px 105px 105px 85px 75px";

function TableHeaderCol({
  label,
  sortKey,
  current,
  onSort,
  align = "right",
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = current.key === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider select-none",
        "transition-colors duration-150 py-3",
        align === "right" ? "justify-end ml-auto" : "justify-start",
        active ? "text-accent font-extrabold" : "text-text-muted hover:text-text-primary",
        className
      )}
    >
      <span>{label}</span>
      <i
        className={cn(
          "text-[12px] transition-transform",
          active
            ? current.dir === "asc"
              ? "ri-arrow-up-s-fill text-accent"
              : "ri-arrow-down-s-fill text-accent"
            : "ri-arrow-up-down-line opacity-25"
        )}
      />
    </button>
  );
}

// ─── Token Row ────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  rank,
  onTrade,
  isSelected,
}: {
  token: Token;
  rank: number;
  onTrade: (token: Token) => void;
  isSelected?: boolean;
}) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { isWatched, toggle } = useWatchlist(publicKey?.toBase58());
  const watched = isWatched(token.mint);

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pct = token.priceChange24h ?? 0;
  const isPositive = pct >= 0;

  async function handleCopyMint(e: React.MouseEvent) {
    e.stopPropagation();
    await copyToClipboard(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    setMenuOpen(false);
  }

  function handleToggleWatchlist(e: React.MouseEvent) {
    e.stopPropagation();
    toggle({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoUri: token.logoUri,
      price: token.price,
    });
  }

  return (
    <motion.div
      variants={variants.fadeUp}
      onClick={() => router.push(`/token/${token.mint}`)}
      style={{ gridTemplateColumns: COLS }}
      className={cn(
        "grid items-center gap-x-3 px-4 h-[56px] relative",
        "border-b border-white/[0.04] last:border-0",
        "hover:bg-white/[0.04] transition-colors duration-150 cursor-pointer group",
        isSelected && "bg-white/[0.07]"
      )}
    >
      {/* Rank & Favorite Star */}
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleToggleWatchlist}
          className={cn(
            "p-0.5 rounded transition-transform hover:scale-125 select-none",
            watched
              ? "text-amber-400 opacity-100"
              : "text-text-muted opacity-30 hover:opacity-100 hover:text-amber-400"
          )}
          title={watched ? "Remove from watchlist" : "Add to watchlist"}
        >
          <i className={cn(watched ? "ri-star-fill text-amber-400 text-xs" : "ri-star-line text-xs")} />
        </button>
        <span className="text-[11px] text-text-muted font-mono tabular-nums text-left font-medium">
          {rank}
        </span>
      </div>

      {/* Coin identity */}
      <div className="flex items-center gap-2.5 min-w-0 pr-1">
        <TokenAvatar
          logoUri={token.logoUri}
          symbol={token.symbol}
          size={30}
          className="border border-white/10 flex-shrink-0"
        />
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-bold text-text-primary tracking-tight group-hover:text-accent transition-colors truncate">
              {token.symbol}
            </span>
            <span className="text-[11px] text-text-muted truncate hidden 2xl:inline">
              {token.name}
            </span>
            {token.launchpad && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-secondary/15 text-secondary font-bold uppercase tracking-wider">
                Curve
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-muted font-mono truncate 2xl:hidden">
            {truncateAddress(token.mint, 3)}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="text-xs sm:text-sm font-bold tabular-nums text-text-primary font-mono">
          {token.price !== undefined ? formatPrice(token.price) : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* 24h % */}
      <div className="text-right">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-bold font-mono px-1.5 py-0.5 rounded",
            isPositive
              ? "text-accent bg-accent/10"
              : "text-error bg-error/10"
          )}
        >
          <i className={cn("text-[9px]", isPositive ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
          <span>{formatPct(Math.abs(pct), 1)}</span>
        </span>
      </div>

      {/* Market Cap */}
      <div className="text-right">
        <p className="text-xs font-semibold tabular-nums text-text-secondary font-mono">
          {token.marketCap !== undefined && token.marketCap > 0
            ? `$${formatNumber(token.marketCap, 0, { compact: true })}`
            : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* 24h Volume */}
      <div className="text-right">
        <p className="text-xs font-semibold tabular-nums text-text-secondary font-mono">
          {token.volume24h !== undefined && token.volume24h > 0
            ? `$${formatNumber(token.volume24h, 0, { compact: true })}`
            : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* Trend Chart (SVG Sparkline) */}
      <div className="flex justify-end pr-1">
        <MiniSparkline
          delta={token.priceChange24h || 0}
          seed={token.mint}
          height={22}
          width={70}
          showArea={false}
          className="opacity-80 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 relative" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onTrade(token)}
          className={cn(
            "h-6 px-2.5 rounded-full text-[11px] font-bold tracking-wide cursor-pointer",
            "glass-pill text-accent border-accent/30",
            "hover:bg-accent hover:text-[#08090C] hover:border-accent shadow-sm",
            "transition-all duration-150 inline-flex items-center gap-1 select-none"
          )}
          title={`Trade ${token.symbol}`}
        >
          <i className="ri-arrow-left-right-line text-[10px]" />
          <span>Trade</span>
        </button>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="h-6 w-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-colors cursor-pointer"
          title="More options"
        >
          <i className={cn("ri-more-2-fill text-[11px] transition-transform", menuOpen && "text-accent")} />
        </button>

        {/* Action Menu Popover */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                className="absolute right-0 top-full mt-1 z-50 min-w-[170px] glass-panel rounded-xl shadow-2xl p-1 text-xs text-text-primary overflow-hidden backdrop-blur-2xl"
              >
                <button
                  onClick={() => {
                    onTrade(token);
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] hover:text-accent transition-colors text-left"
                >
                  <i className="ri-swap-line text-sm text-accent" />
                  <span>Quick Swap</span>
                </button>

                <button
                  onClick={handleCopyMint}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] text-left transition-colors"
                >
                  <i className={cn("text-sm", copied ? "ri-check-line text-accent" : "ri-file-copy-line text-text-muted")} />
                  <span>{copied ? "Copied!" : "Copy CA"}</span>
                </button>

                <a
                  href={`https://cookiescan.io/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/[0.08] hover:text-accent transition-colors"
                >
                  <i className="ri-external-link-line text-sm text-text-muted" />
                  <span>CookieScan</span>
                </a>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      style={{ gridTemplateColumns: COLS }}
      className="grid items-center gap-x-3 px-4 h-[56px] border-b border-white/[0.04]"
    >
      <div className="w-4 h-3 rounded bg-white/[0.04] animate-pulse" />
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-white/[0.04] animate-pulse flex-shrink-0" />
        <div className="space-y-1 min-w-0">
          <div className="w-14 h-3 rounded bg-white/[0.04] animate-pulse" />
          <div className="w-20 h-2 rounded bg-white/[0.04] animate-pulse" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-16 h-3.5 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-12 h-3.5 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-14 h-3.5 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-14 h-3.5 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-14 h-3 rounded bg-white/[0.04] animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-12 h-5 rounded-full bg-white/[0.04] animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main Discover Page ───────────────────────────────────────────────────────

export default function DiscoverPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { isWatched } = useWatchlist(publicKey?.toBase58());

  const [tokens, setTokens] = useState<Token[]>([]);
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedTradeToken, setSelectedTradeToken] = useState<Token | undefined>(undefined);

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "volume24h",
    dir: "desc",
  });

  // Global Ctrl+K / Cmd+K listener to open search modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, price] = await Promise.all([getTopTokens(200), getCookPrice()]);
      setTokens(data);
      setCookUsd(price);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  // Handle selecting a token for quick trading in the docked terminal
  function handleTradeToken(token: Token) {
    setSelectedTradeToken(token);
    // On mobile, smooth scroll to the swap card
    if (window.innerWidth < 1280) {
      const swapEl = document.getElementById("docked-swap-panel");
      if (swapEl) {
        swapEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  // Filter & sort
  const displayed = useMemo(() => {
    return [...tokens]
      .filter((t) => {
        // Tab Filters
        if (activeFilter === "favorites") {
          return isWatched(t.mint);
        }
        if (activeFilter === "gainers") {
          return (t.priceChange24h || 0) > 0;
        }
        if (activeFilter === "losers") {
          return (t.priceChange24h || 0) < 0;
        }

        // Search filter
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.mint.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (activeFilter === "gainers") {
          return (b.priceChange24h || 0) - (a.priceChange24h || 0);
        }
        if (activeFilter === "losers") {
          return (a.priceChange24h || 0) - (b.priceChange24h || 0);
        }
        const av = (a[sort.key] as number | undefined) ?? -Infinity;
        const bv = (b[sort.key] as number | undefined) ?? -Infinity;
        if (bv !== av) {
          return sort.dir === "asc" ? av - bv : bv - av;
        }
        return (b.marketCap ?? 0) - (a.marketCap ?? 0);
      });
  }, [tokens, query, activeFilter, sort, isWatched]);

  const totalLiquidity = useMemo(
    () => tokens.reduce((acc, t) => acc + (t.liquidity ?? 0), 0),
    [tokens]
  );
  const totalVolume = useMemo(
    () => tokens.reduce((acc, t) => acc + (t.volume24h ?? 0), 0),
    [tokens]
  );

  return (
    <div className="w-full">
      {/* ─── TOP TICKER TAPE (FULL VIEWPORT WIDTH) ─── */}
      <MarketTickerTape tokens={tokens} onSelectToken={handleTradeToken} />

      {/* ─── MAIN DISCOVER CONTENT (COMPACT TOP SPACING) ─── */}
      <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 pt-3 sm:pt-4 pb-8 space-y-5">
        {/* ─── HEADER BAR: BREADCRUMBS & SEARCH ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-text-primary">
            Cookie Chain Markets
          </h1>
        </div>

        {/* Search input & Quick Tools */}
        <div className="flex items-center gap-2">
          <div
            onClick={() => setSearchModalOpen(true)}
            className="relative flex-1 sm:flex-initial cursor-pointer"
          >
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none" />
            <input
              type="text"
              readOnly
              placeholder="Search token or address..."
              onClick={() => setSearchModalOpen(true)}
              onFocus={() => setSearchModalOpen(true)}
              className={cn(
                "h-9 pl-8 pr-10 sm:pr-12 w-full sm:w-64 text-xs font-medium cursor-pointer select-none",
                "glass-input rounded-xl",
                "text-text-primary placeholder:text-text-muted",
                "hover:border-accent/40 focus:outline-none transition-all duration-150"
              )}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSearchModalOpen(true);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono text-text-muted glass-pill hover:text-accent transition-colors cursor-pointer"
              title="Global search (Ctrl+K)"
            >
              /
            </button>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold glass-pill text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer flex-shrink-0"
            title="Refresh market data"
          >
            <i className={cn("ri-refresh-line text-xs", loading && "animate-spin text-accent")} />
            <span className="hidden md:inline">Refresh</span>
          </button>

          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 sm:px-3.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all duration-200 inline-flex items-center gap-1.5 select-none flex-shrink-0"
          >
            <i className="ri-notification-3-line text-xs" />
            <span className="hidden xs:inline">Alerts</span>
          </a>
        </div>
      </div>

      {/* ─── 2-COLUMN SPLIT LAYOUT (MARKET ON LEFT, EXCHANGE ON RIGHT) ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: HERO HIGHLIGHTS & MARKET OVERVIEW TABLE (8 COLS) */}
        <div className="xl:col-span-8 space-y-6">
          {/* Live Crypto Updates (3-Card Spotlight) */}
          <LiveHighlights
            tokens={tokens}
            cookPrice={cookUsd || 0.000075}
            onTradeToken={handleTradeToken}
            selectedMint={selectedTradeToken?.mint}
          />

          {/* Market Overview Table Header & Filter Tabs */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h2 className="text-base font-bold text-text-primary tracking-tight">
                  Market Overview
                </h2>
                <p className="text-xs text-text-muted">
                  Real-time SVM liquidity and swap volume across Cookie Chain.
                </p>
              </div>

              {/* Filter Pills with Smooth Sliding Background Animation */}
              <div className="flex items-center gap-1 p-1 rounded-full glass-pill overflow-x-auto no-scrollbar max-w-full">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "favorites", label: "Watchlist" },
                    { id: "gainers", label: "Top Gainers" },
                    { id: "losers", label: "Top Losers" },
                  ] as const
                ).map((tab) => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={cn(
                        "relative px-3.5 py-1.5 rounded-full text-xs font-bold tracking-tight transition-colors duration-200 select-none cursor-pointer whitespace-nowrap",
                        isActive
                          ? "text-accent"
                          : "text-text-muted hover:text-text-secondary hover:bg-white/[0.04]"
                      )}
                    >
                      <span className="relative z-10">{tab.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="active-market-filter-pill"
                          className="absolute inset-0 rounded-full bg-accent/20 border border-accent/40 shadow-[0_0_14px_rgba(59,178,115,0.28)]"
                          transition={{ type: "spring", stiffness: 480, damping: 32 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Market Table Card Container */}
            <div className="squircle glass-panel overflow-hidden">
              {/* Mobile Horizontal Scroll Hint */}
              <div className="md:hidden flex items-center justify-between px-3.5 py-2 border-b border-white/[0.06] bg-white/[0.02] text-[11px] text-text-muted select-none">
                <span className="flex items-center gap-1.5">
                  <i className="ri-arrow-left-right-line text-accent text-xs" />
                  <span>Scroll sideways for all metrics & trade</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-accent">
                  Swipe →
                </span>
              </div>

              {/* Responsive Horizontal Scroll Container */}
              <div className="overflow-x-auto no-scrollbar touch-pan-x">
                <div className="min-w-[760px]">
                  {/* Table Column Headers */}
                  <div
                    style={{ gridTemplateColumns: COLS }}
                    className="grid items-center gap-x-3 px-4 bg-white/[0.03] backdrop-blur-md border-b border-white/[0.08] text-xs text-text-muted font-bold select-none"
                  >
                    <span className="text-[10px] uppercase font-bold text-text-muted flex items-center gap-1">
                      <span>#</span>
                    </span>
                    <TableHeaderCol label="Coin Name" sortKey="marketCap" current={sort} onSort={handleSort} align="left" />
                    <TableHeaderCol label="Price" sortKey="price" current={sort} onSort={handleSort} />
                    <TableHeaderCol label="24h %" sortKey="priceChange24h" current={sort} onSort={handleSort} />
                    <TableHeaderCol label="Market Cap" sortKey="marketCap" current={sort} onSort={handleSort} />
                    <TableHeaderCol label="Volume (24h)" sortKey="volume24h" current={sort} onSort={handleSort} />
                    <span className="text-right text-[10px] uppercase font-bold text-text-muted py-3 pr-2">
                      Trend
                    </span>
                    <span className="text-right text-[10px] uppercase font-bold text-text-muted py-3">
                      Action
                    </span>
                  </div>

                  {/* Table Rows */}
                  <div className="divide-y divide-white/[0.04] min-h-[360px]">
                    <AnimatePresence mode="wait">
                      {loading ? (
                        <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          {Array.from({ length: 10 }).map((_, i) => (
                            <SkeletonRow key={i} />
                          ))}
                        </motion.div>
                      ) : error ? (
                        <motion.div
                          key="error"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="py-20 text-center space-y-3"
                        >
                          <div className="w-12 h-12 rounded-full bg-error/10 border border-error/30 flex items-center justify-center mx-auto text-error text-2xl">
                            <i className="ri-error-warning-line" />
                          </div>
                          <p className="text-sm font-semibold text-text-primary">Failed to load market data</p>
                          <p className="text-xs text-text-muted max-w-md mx-auto">{error}</p>
                          <button
                            onClick={load}
                            className="mt-2 h-8 px-5 rounded-full text-xs font-bold bg-accent text-[#08090C] hover:bg-[#45c381] transition-colors"
                          >
                            Retry
                          </button>
                        </motion.div>
                      ) : displayed.length === 0 ? (
                        <motion.div
                          key="empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="py-20 text-center space-y-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-text-muted text-xl">
                            <i className="ri-search-line" />
                          </div>
                          <p className="text-sm font-semibold text-text-primary">No tokens found</p>
                          <p className="text-xs text-text-muted">
                            No tokens matched your filter criteria.
                          </p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="list"
                          variants={variants.staggerChildren}
                          initial="hidden"
                          animate="visible"
                        >
                          {displayed.map((token, i) => (
                            <TokenRow
                              key={token.mint}
                              token={token}
                              rank={i + 1}
                              onTrade={handleTradeToken}
                              isSelected={selectedTradeToken?.mint === token.mint}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DOCKED EXCHANGE & ACTIVITY (4 COLS) */}
        <div id="docked-swap-panel" className="xl:col-span-4 space-y-4 xl:sticky xl:top-6">
          {/* Exchange Header Tag */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                Exchange
              </span>
              <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25 text-[10px] font-bold uppercase tracking-wider">
                Cookieswap DEX
              </span>
            </div>

            <Link
              href="/swap"
              className="text-xs text-text-muted hover:text-accent transition-colors flex items-center gap-1"
            >
              <span>Full Screen</span>
              <i className="ri-fullscreen-line text-[11px]" />
            </Link>
          </div>

          {/* Embedded Real Swap Card */}
          <div className="squircle glass-panel overflow-hidden p-1">
            <SwapCard
              initialOutputToken={selectedTradeToken}
              className="border-0 shadow-none bg-transparent p-3"
            />
          </div>

          {/* Ecosystem Pulse Stats */}
          <EcosystemPulse
            volume24h={totalVolume}
            liquidity={totalLiquidity}
            trackedTokensCount={tokens.length}
          />
        </div>
      </div>

      {/* Global Token Search Modal */}
      <TokenSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectToken={(token: Token) => {
          setSearchModalOpen(false);
          router.push(`/token/${token.mint}`);
        }}
      />
      </div>
    </div>
  );
}
