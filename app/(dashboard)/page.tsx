"use client";

/**
 * app/(dashboard)/page.tsx — Discover
 * Dense, full-scale trading-terminal token list inspired by Birdeye & Traderly.
 * Browsable with or without a connected wallet.
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
  formatUsd,
  deltaColorClass,
  truncateAddress,
  copyToClipboard,
} from "@/lib";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/tokens";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  delta?: number;
}) {
  return (
    <div className="flex items-center gap-3.5 px-4 py-3 rounded-xl bg-bg-card/90 border border-border hover:border-border/80 transition-all duration-200 shadow-sm backdrop-blur-sm">
      <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
        <i className={cn(icon, "text-accent text-base")} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-base font-bold text-text-primary tabular-nums font-mono">{value}</p>
          {delta !== undefined && (
            <span className={cn("text-xs font-semibold tabular-nums", deltaColorClass(delta))}>
              {formatPct(delta)}
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] text-text-secondary truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Token Logo ───────────────────────────────────────────────────────────────

function TokenLogo({ token }: { token: Token }) {
  return (
    <TokenAvatar
      logoUri={token.logoUri}
      symbol={token.symbol}
      size={32}
      className="border border-border"
    />
  );
}

// ─── Table Types & Header ─────────────────────────────────────────────────────

type SortKey = "price" | "priceChange24h" | "volume24h" | "marketCap" | "liquidity" | "holderCount";

const COLS = "56px minmax(220px,2.5fr) 130px 140px 140px 110px 110px";

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
        "flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider select-none",
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

function TokenRow({ token, rank }: { token: Token; rank: number }) {
  const router = useRouter();
  const { publicKey } = useWallet();
  const { isWatched, toggle } = useWatchlist(publicKey?.toBase58());
  const watched = isWatched(token.mint);

  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const changeClass = deltaColorClass(token.priceChange24h ?? 0);
  const pct = token.priceChange24h ?? 0;

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
        "grid items-center gap-x-4 px-5 h-[58px] relative",
        "border-b border-border/50 last:border-0",
        "hover:bg-bg-elevated/70 transition-colors duration-150 cursor-pointer group"
      )}
    >
      {/* Star & Rank */}
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
          <i className={cn(watched ? "ri-star-fill text-amber-400 text-sm" : "ri-star-line text-sm")} />
        </button>
        <span className="text-xs text-text-muted font-mono tabular-nums text-left font-medium">
          {rank}
        </span>
      </div>

      {/* Token identity */}
      <div className="flex items-center gap-3 min-w-0 pr-2">
        <TokenLogo token={token} />
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-text-primary tracking-wide group-hover:text-accent transition-colors truncate">
              {token.symbol}
            </span>
            <span className="text-xs text-text-secondary truncate hidden xl:inline">
              {token.name}
            </span>
            {token.launchpad && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary/20 text-secondary font-bold uppercase tracking-wider">
                Curve
              </span>
            )}
          </div>
          <span className="text-[11px] text-text-muted font-mono truncate xl:hidden">
            {truncateAddress(token.mint, 4)}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-text-primary font-mono">
          {token.price !== undefined ? formatPrice(token.price) : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* Volume 24h & 24h Change */}
      <div className="text-right flex flex-col justify-center">
        <p className="text-sm font-semibold tabular-nums text-text-primary font-mono">
          {token.volume24h !== undefined && token.volume24h > 0
            ? `$${formatNumber(token.volume24h, 0, { compact: true })}`
            : <span className="text-text-muted">—</span>}
        </p>
        <div className={cn("flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums", changeClass)}>
          {token.priceChange24h !== undefined ? (
            <>
              <i className={cn("text-[11px]", pct >= 0 ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
              <span>{formatPct(Math.abs(pct), 2)}</span>
            </>
          ) : (
            <span className="text-text-muted text-[11px]">—</span>
          )}
        </div>
      </div>

      {/* Market Cap */}
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-text-secondary font-mono">
          {token.marketCap !== undefined && token.marketCap > 0
            ? `$${formatNumber(token.marketCap, 0, { compact: true })}`
            : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* Holders */}
      <div className="text-right">
        <p className="text-sm font-medium tabular-nums text-text-secondary font-mono">
          {token.holderCount !== undefined && token.holderCount > 0
            ? formatNumber(token.holderCount, 0)
            : <span className="text-text-muted">—</span>}
        </p>
      </div>

      {/* Actions (Pill button with swap arrows + dropdown chevron) */}
      <div className="flex items-center justify-end gap-1 relative" onClick={(e) => e.stopPropagation()}>
        {/* Quick Swap Pill */}
        <Link
          href={`/swap?outputMint=${token.mint}`}
          className={cn(
            "h-7 px-2.5 rounded-full text-xs font-bold tracking-wide",
            "bg-accent/15 text-accent border border-accent/30",
            "hover:bg-accent hover:text-[#08090C] hover:border-accent shadow-[0_0_10px_rgba(59,178,115,0.15)]",
            "transition-all duration-150 inline-flex items-center gap-1 select-none"
          )}
          title={`Trade ${token.symbol} on Cookieswap`}
        >
          <i className="ri-arrow-left-right-line text-[11px]" />
          <span>Trade</span>
        </Link>

        {/* Dropdown trigger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="h-7 w-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card transition-colors"
          title="More options"
        >
          <i className={cn("ri-more-2-fill text-xs transition-transform", menuOpen && "text-accent")} />
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
                className="absolute right-0 top-full mt-1.5 z-50 min-w-[190px] bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 text-xs text-text-primary overflow-hidden backdrop-blur-xl"
              >
                <Link
                  href={`/swap?outputMint=${token.mint}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-elevated hover:text-accent transition-colors"
                >
                  <i className="ri-swap-line text-sm text-accent" />
                  <span>Swap {token.symbol}</span>
                </Link>

                <button
                  onClick={handleCopyMint}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-elevated text-left transition-colors"
                >
                  <i className={cn("text-sm", copied ? "ri-check-line text-accent" : "ri-file-copy-line text-text-muted")} />
                  <span>{copied ? "Copied!" : "Copy Mint Address"}</span>
                </button>

                <a
                  href={`https://cookiescan.io/token/${token.mint}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-elevated hover:text-accent transition-colors"
                >
                  <i className="ri-external-link-line text-sm text-text-muted" />
                  <span>View on Explorer</span>
                </a>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div
      style={{ gridTemplateColumns: COLS }}
      className="grid items-center gap-x-4 px-5 h-[58px] border-b border-border/40"
    >
      <div className="w-5 h-3 rounded bg-bg-elevated animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-bg-elevated animate-pulse flex-shrink-0" />
        <div className="space-y-1.5 min-w-0">
          <div className="w-16 h-3.5 rounded bg-bg-elevated animate-pulse" />
          <div className="w-24 h-2.5 rounded bg-bg-elevated animate-pulse" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-20 h-4 rounded bg-bg-elevated animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-24 h-4 rounded bg-bg-elevated animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-20 h-4 rounded bg-bg-elevated animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-14 h-4 rounded bg-bg-elevated animate-pulse" />
      </div>
      <div className="flex justify-end">
        <div className="w-16 h-6 rounded-full bg-bg-elevated animate-pulse" />
      </div>
    </div>
  );
}

// ─── Main Discover Page ───────────────────────────────────────────────────────

const TIMEFRAMES = ["1D", "1W", "1M", "3M", "1Y", "YTD", "ALL"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const CATEGORIES = [
  { id: "all", label: "All Tokens" },
  { id: "dex", label: "DEX Verified" },
  { id: "curve", label: "Bonding Curves" },
] as const;
type Category = (typeof CATEGORIES)[number]["id"];

export default function DiscoverPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>("1D");
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "marketCap",
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

  // Filter & sort
  const displayed = useMemo(() => {
    return [...tokens]
      .filter((t) => {
        // Category filter
        if (category === "curve" && !t.launchpad) return false;
        if (category === "dex" && t.launchpad) return false;

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
        const av = (a[sort.key] as number | undefined) ?? -Infinity;
        const bv = (b[sort.key] as number | undefined) ?? -Infinity;
        return sort.dir === "asc" ? av - bv : bv - av;
      });
  }, [tokens, query, category, sort]);

  const totalLiquidity = useMemo(
    () => tokens.reduce((acc, t) => acc + (t.liquidity ?? 0), 0),
    [tokens]
  );
  const totalVolume = useMemo(
    () => tokens.reduce((acc, t) => acc + (t.volume24h ?? 0), 0),
    [tokens]
  );

  return (
    <div className="space-y-6">
      {/* Top Context Subheader (Reference match) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Cookie Chain Markets
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time tokens, liquidity pools, and trading volume on Cookie Chain.
          </p>
        </div>

        {/* Quick Search & Alerts */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchModalOpen(true)}
            className="h-8 px-3.5 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors inline-flex items-center gap-2 select-none"
            title="Search tokens by name, symbol, or contract address (Ctrl+K)"
          >
            <i className="ri-search-line text-xs text-accent" />
            <span className="hidden sm:inline">Search Tokens or CA</span>
            <span className="sm:hidden">Search</span>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[9px] font-mono text-text-muted bg-bg-elevated border border-border rounded">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={load}
            disabled={loading}
            className="h-8 px-3 rounded-full text-xs font-medium bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            title="Refresh market data"
          >
            <i className={cn("ri-refresh-line text-xs", loading && "animate-spin text-accent")} />
            <span>Refresh</span>
          </button>

          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_12px_rgba(59,178,115,0.3)] transition-all duration-200 inline-flex items-center gap-1.5 select-none"
          >
            <i className="ri-notification-3-line text-xs" />
            <span>Alerts</span>
          </a>
        </div>
      </div>

      {/* Terminal Stats Row */}
      <motion.div
        variants={variants.fadeDown}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <StatCard
          icon="ri-coin-line"
          label="COOK Spot Price"
          value={cookUsd ? formatPrice(cookUsd) : "—"}
          sub="Native Cookie Chain Gas"
        />
        <StatCard
          icon="ri-water-flash-line"
          label="Total DEX Liquidity"
          value={loading ? "—" : formatUsd(totalLiquidity, 0)}
          sub="Across all active pools"
        />
        <StatCard
          icon="ri-exchange-dollar-line"
          label="24h Trading Volume"
          value={loading ? "—" : formatUsd(totalVolume, 0)}
          sub="Verified DEX swaps"
        />
        <StatCard
          icon="ri-database-2-line"
          label="Tracked Tokens"
          value={loading ? "—" : formatNumber(tokens.length, 0)}
          sub="Live on Cookie DAS"
        />
      </motion.div>

      {/* Main Glass Card Table Container */}
      <motion.div
        variants={variants.fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-border/80 bg-bg-card/90 shadow-2xl overflow-hidden backdrop-blur-md"
      >
        {/* Table Top Header Bar */}
        <div
          style={{ gridTemplateColumns: COLS }}
          className="grid items-center gap-x-4 px-5 bg-bg/50 border-b border-border text-xs text-text-muted"
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1">
            <span className="text-amber-400/80">★</span>
            <span>#</span>
          </span>
          <TableHeaderCol label="Token Name" sortKey="marketCap" current={sort} onSort={handleSort} align="left" />
          <TableHeaderCol label="Price" sortKey="price" current={sort} onSort={handleSort} />
          <TableHeaderCol label="Trading Volume (24h)" sortKey="volume24h" current={sort} onSort={handleSort} />
          <TableHeaderCol label="Market Cap" sortKey="marketCap" current={sort} onSort={handleSort} />
          <TableHeaderCol label="Holders" sortKey="holderCount" current={sort} onSort={handleSort} />
          <span className="text-right text-[11px] font-bold uppercase tracking-wider text-text-muted py-3">
            Actions
          </span>
        </div>

        {/* Table Rows Body */}
        <div className="divide-y divide-border/40 min-h-[360px]">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {Array.from({ length: 14 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </motion.div>
            ) : error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 text-center space-y-3"
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
                  Retry Connection
                </button>
              </motion.div>
            ) : displayed.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 text-center space-y-3"
              >
                <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center mx-auto text-text-muted text-2xl">
                  <i className="ri-search-line" />
                </div>
                <p className="text-sm font-semibold text-text-primary">No tokens found</p>
                <p className="text-xs text-text-muted">
                  No match for &ldquo;{query}&rdquo; in current filter
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
                  <TokenRow key={token.mint} token={token} rank={i + 1} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Table Bottom Controls Bar (Matches Reference Footer) */}
        <div className="px-5 py-3.5 border-t border-border bg-bg/60 flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Left: Timeframe Switcher */}
          <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted select-none mr-1">
              Timeframe
            </span>
            <div className="flex items-center gap-1 bg-bg-card p-1 rounded-full border border-border">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={cn(
                    "h-6 px-3 rounded-full text-[11px] font-bold tracking-wider transition-all select-none",
                    activeTimeframe === tf
                      ? "bg-accent text-[#08090C] shadow-[0_0_8px_rgba(59,178,115,0.4)]"
                      : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Category Pills + Search input */}
          <div className="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto">
            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-bg-card p-1 rounded-full border border-border">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={cn(
                    "h-6 px-3 rounded-full text-[11px] font-medium transition-all select-none",
                    category === cat.id
                      ? "bg-bg-elevated text-text-primary border border-border/80 shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Token Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or CA..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchModalOpen(true);
                }}
                className={cn(
                  "h-8 pl-8 pr-12 w-full sm:w-56 text-xs",
                  "bg-bg-card border border-border rounded-full",
                  "text-text-primary placeholder:text-text-muted",
                  "focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20",
                  "transition-colors duration-150"
                )}
              />
              <button
                onClick={() => setSearchModalOpen(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono text-text-muted bg-bg-elevated border border-border hover:text-accent hover:border-accent/30 transition-colors"
                title="Open full search modal (Ctrl+K)"
              >
                ⌘K
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Global Token Search Modal (Name, Symbol, and CA / Mint) */}
      <TokenSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />
    </div>
  );
}
