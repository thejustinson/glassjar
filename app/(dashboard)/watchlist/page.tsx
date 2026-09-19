"use client";

/**
 * app/(dashboard)/watchlist/page.tsx
 * Watchlist & Lightweight PnL Tracking Terminal for Cookie Chain.
 *
 * Persists per-wallet (with guest fallback).
 * Shows real-time DAS prices, 24h changes, since-watched deltas,
 * on-chain wallet balances, and paper/realized PnL.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useWatchlist,
  type WatchlistItem,
  formatPrice,
  formatPct,
  formatNumber,
  formatUsd,
  deltaColorClass,
  truncateAddress,
  copyToClipboard,
  COOK_MINT,
  getCookBalance,
  getTokenBalance,
} from "@/lib";
import { getTopTokens, getTokenByMint, getCookPrice, type Token } from "@/lib/das";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { TokenSearchModal } from "@/components/search/TokenSearchModal";
import { WatchlistEditModal } from "@/components/watchlist/WatchlistEditModal";
import { cn } from "@/lib/utils";
import { variants } from "@/lib/tokens";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  delta,
  valueColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  delta?: number;
  valueColor?: string;
}) {
  return (
    <div className="p-4 sm:p-4.5 squircle-md bg-[#0E1015] border border-border transition-all hover:border-accent/40 group relative overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</p>
        <div className="w-7 h-7 squircle-xs bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
          <i className={cn(icon, "text-accent text-xs")} />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2 flex-wrap">
        <p
          className={cn(
            "text-lg sm:text-xl font-extrabold tabular-nums font-mono tracking-tight",
            valueColor || "text-text-primary"
          )}
        >
          {value}
        </p>
        {delta !== undefined && (
          <span
            className={cn(
              "text-xs font-bold tabular-nums font-mono px-2 py-0.5 rounded-full",
              delta >= 0
                ? "bg-success/15 text-success border border-success/30"
                : "bg-error/15 text-error border border-error/30"
            )}
          >
            {formatPct(delta)}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-text-secondary truncate mt-1">{sub}</p>}
    </div>
  );
}

// ─── Enriched Watchlist Token Shape ──────────────────────────────────────────

interface EnrichedToken {
  item: WatchlistItem;
  liveToken?: Token;
  currentPrice: number;
  priceChange24h: number;
  volume24h?: number;
  marketCap?: number;
  sinceWatchedPct: number | null;
  walletBalance: number;
  positionValue: number;
  unrealizedPnl: number | null;
  timeAgo: string;
}

function formatDurationAgo(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// Table column layout for Birdeye density
const COLS = "36px minmax(200px, 2.2fr) 110px 110px 105px 120px 110px 130px 125px";

export default function WatchlistPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const walletAddress = publicKey ? publicKey.toBase58() : null;

  const { items, remove, add, update, count } = useWatchlist(walletAddress);

  // Live data states
  const [tokensMap, setTokensMap] = useState<Record<string, Token>>({});
  const [balancesMap, setBalancesMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "gainers" | "losers" | "holdings">("all");
  const [sortKey, setSortKey] = useState<"sinceWatched" | "change24h" | "price" | "value" | "addedAt">("sinceWatched");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);

  // Copy CA feedback
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  const handleCopyCA = useCallback((mint: string, e: React.MouseEvent) => {
    e.stopPropagation();
    copyToClipboard(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1800);
  }, []);

  // Suggested tokens for empty state
  const [suggestedTokens, setSuggestedTokens] = useState<Token[]>([]);

  // 1. Fetch live prices & market data
  const fetchLiveData = useCallback(async () => {
    if (items.length === 0) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Fetch top tokens in bulk (fastest)
      const top = await getTopTokens(200);
      const map: Record<string, Token> = {};
      top.forEach((t) => {
        map[t.mint.toLowerCase()] = t;
      });

      // For any watched token not in top 200, query directly
      const missingMints = items.filter(
        (i) => !map[i.mint.toLowerCase()]
      );

      if (missingMints.length > 0) {
        await Promise.all(
          missingMints.map(async (i) => {
            try {
              const direct = await getTokenByMint(i.mint);
              if (direct) {
                map[direct.mint.toLowerCase()] = direct;
              }
            } catch {}
          })
        );
      }

      setTokensMap(map);
      setLastUpdated(new Date());

      // Fetch on-chain balances if wallet connected
      if (walletAddress) {
        const balMap: Record<string, number> = {};
        await Promise.all(
          items.map(async (i) => {
            try {
              if (i.mint.toLowerCase() === COOK_MINT.toLowerCase()) {
                const bal = await getCookBalance(walletAddress);
                balMap[i.mint.toLowerCase()] = bal;
              } else {
                const tokenBal = await getTokenBalance(walletAddress, i.mint);
                balMap[i.mint.toLowerCase()] = tokenBal ? tokenBal.uiAmount : 0;
              }
            } catch {
              balMap[i.mint.toLowerCase()] = 0;
            }
          })
        );
        setBalancesMap(balMap);
      }
    } catch (err) {
      console.error("Error refreshing watchlist data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [items, walletAddress]);

  // Initial load & periodic auto-refresh every 20s
  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 20000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  // Load suggested tokens when watchlist is empty
  useEffect(() => {
    if (items.length === 0) {
      getTopTokens(6)
        .then((toks) => setSuggestedTokens(toks))
        .catch(() => {});
    }
  }, [items.length]);

  function handleManualRefresh() {
    setRefreshing(true);
    fetchLiveData();
  }

  // 2. Compute enriched tokens
  const enrichedTokens: EnrichedToken[] = useMemo(() => {
    return items.map((item) => {
      const live = tokensMap[item.mint.toLowerCase()];
      const currentPrice = live?.price ?? item.addedPrice ?? 0;
      const priceChange24h = live?.priceChange24h ?? 0;

      // Since-watched delta
      let sinceWatchedPct: number | null = null;
      if (item.addedPrice > 0 && currentPrice > 0) {
        sinceWatchedPct = ((currentPrice - item.addedPrice) / item.addedPrice) * 100;
      }

      // Wallet balance (or tracked paper amount if user set one)
      const onChainBal = balancesMap[item.mint.toLowerCase()] ?? 0;
      const effectiveBalance = onChainBal > 0 ? onChainBal : (item.trackedAmount ?? 0);
      const positionValue = effectiveBalance * currentPrice;

      // PnL
      let unrealizedPnl: number | null = null;
      if (effectiveBalance > 0 && item.addedPrice > 0) {
        unrealizedPnl = effectiveBalance * (currentPrice - item.addedPrice);
      }

      return {
        item,
        liveToken: live,
        currentPrice,
        priceChange24h,
        volume24h: live?.volume24h,
        marketCap: live?.marketCap,
        sinceWatchedPct,
        walletBalance: effectiveBalance,
        positionValue,
        unrealizedPnl,
        timeAgo: formatDurationAgo(item.addedAt),
      };
    });
  }, [items, tokensMap, balancesMap]);

  // 3. Aggregate Performance Metrics
  const stats = useMemo(() => {
    if (enrichedTokens.length === 0) {
      return {
        count: 0,
        avgReturn: 0,
        topGainer: null as { symbol: string; pct: number } | null,
        totalPortfolioValue: 0,
        totalUnrealizedPnl: 0,
      };
    }

    let validPctCount = 0;
    let sumPct = 0;
    let topGainer: { symbol: string; pct: number } | null = null;
    let totalPortfolioValue = 0;
    let totalUnrealizedPnl = 0;

    enrichedTokens.forEach((t) => {
      if (t.sinceWatchedPct !== null) {
        sumPct += t.sinceWatchedPct;
        validPctCount++;
        if (!topGainer || t.sinceWatchedPct > topGainer.pct) {
          topGainer = { symbol: t.item.symbol, pct: t.sinceWatchedPct };
        }
      }
      totalPortfolioValue += t.positionValue;
      if (t.unrealizedPnl !== null) {
        totalUnrealizedPnl += t.unrealizedPnl;
      }
    });

    const avgReturn = validPctCount > 0 ? sumPct / validPctCount : 0;

    return {
      count: enrichedTokens.length,
      avgReturn,
      topGainer,
      totalPortfolioValue,
      totalUnrealizedPnl,
    };
  }, [enrichedTokens]);

  // 4. Filtering & Sorting
  const filteredTokens = useMemo(() => {
    let result = enrichedTokens;

    // Filter tab
    if (activeFilter === "gainers") {
      result = result.filter((t) => (t.sinceWatchedPct ?? 0) > 0);
    } else if (activeFilter === "losers") {
      result = result.filter((t) => (t.sinceWatchedPct ?? 0) < 0);
    } else if (activeFilter === "holdings") {
      result = result.filter((t) => t.walletBalance > 0);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.item.symbol.toLowerCase().includes(q) ||
          t.item.name.toLowerCase().includes(q) ||
          t.item.mint.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortKey === "sinceWatched") {
        valA = a.sinceWatchedPct ?? -999999;
        valB = b.sinceWatchedPct ?? -999999;
      } else if (sortKey === "change24h") {
        valA = a.priceChange24h;
        valB = b.priceChange24h;
      } else if (sortKey === "price") {
        valA = a.currentPrice;
        valB = b.currentPrice;
      } else if (sortKey === "value") {
        valA = a.positionValue;
        valB = b.positionValue;
      } else if (sortKey === "addedAt") {
        valA = a.item.addedAt;
        valB = b.item.addedAt;
      }

      return sortDir === "desc" ? valB - valA : valA - valB;
    });

    return result;
  }, [enrichedTokens, activeFilter, searchQuery, sortKey, sortDir]);

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function handleAddFromSearch(token: Token) {
    add({
      mint: token.mint,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoUri: token.logoUri,
      price: token.price,
    });
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ─── HEADER & REAL-TIME CONTROLS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                Watchlist
              </h1>
            </div>
            <span className="px-3 py-1 rounded-full bg-gradient-to-b from-[#1A1E2B] to-[#11141D] border border-accent/30 text-accent text-xs font-extrabold font-mono">
              {count} {count === 1 ? "Token" : "Tokens"}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>Track real-time prices, 24h performance, and since-watched PnL on Cookie Chain.</span>
            <span className="text-[11px] text-text-secondary font-mono">
              • {walletAddress ? "Live on-chain sync" : "Guest mode (stored locally)"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="h-9 px-3.5 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title={`Last updated ${lastUpdated.toLocaleTimeString()}`}
          >
            <i
              className={cn(
                "ri-refresh-line text-sm",
                refreshing ? "animate-spin text-accent" : ""
              )}
            />
            <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* Add Token Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="h-9 px-4.5 rounded-full bg-accent text-[#08090C] text-xs font-extrabold hover:bg-[#45c381] transition-all flex items-center gap-1.5 select-none cursor-pointer"
          >
            <i className="ri-add-line text-base font-bold" />
            <span>Add Token</span>
          </button>
        </div>
      </div>

      {/* ─── SUMMARY STAT CARDS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Tracked Assets"
          value={String(stats.count)}
          sub={stats.count > 0 ? (walletAddress ? "Synced with wallet" : "Stored locally") : "Empty watchlist"}
          icon="ri-bookmark-3-line"
        />

        <StatCard
          label="Avg. Return (Since Added)"
          value={stats.count > 0 ? formatPct(stats.avgReturn) : "—"}
          delta={stats.count > 0 ? stats.avgReturn : undefined}
          sub="Unweighted tracking delta"
          icon="ri-line-chart-line"
        />

        <StatCard
          label="Top Performer"
          value={stats.topGainer ? stats.topGainer.symbol : "—"}
          sub={
            stats.topGainer
              ? `${formatPct(stats.topGainer.pct)} since added`
              : "No tokens tracked"
          }
          delta={stats.topGainer ? stats.topGainer.pct : undefined}
          icon="ri-trophy-line"
        />

        <StatCard
          label="Tracked Position Value"
          value={stats.totalPortfolioValue > 0 ? formatUsd(stats.totalPortfolioValue) : "$0.00"}
          sub={
            stats.totalUnrealizedPnl !== 0
              ? `Unrealized PnL: ${stats.totalUnrealizedPnl >= 0 ? "+" : ""}${formatUsd(stats.totalUnrealizedPnl)}`
              : walletAddress
              ? "Live on-chain balances"
              : "Connect wallet to track balance"
          }
          icon="ri-wallet-3-line"
          valueColor={stats.totalUnrealizedPnl >= 0 ? "text-accent" : "text-error"}
        />
      </div>

      {/* ─── FILTER & SEARCH TOOLBAR ─── */}
      {items.length > 0 && (
        <div className="p-2 sm:p-2.5 squircle-md bg-gradient-to-b from-[#141824] to-[#0D1017] border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Filter Pills with Sliding Active Indicator */}
          <div className="relative flex items-center p-1 rounded-full bg-black/40 border border-white/5 overflow-x-auto">
            {(
              [
                { id: "all", label: `All (${enrichedTokens.length})` },
                {
                  id: "gainers",
                  label: `Gainers (${enrichedTokens.filter((t) => (t.sinceWatchedPct ?? 0) > 0).length})`,
                },
                {
                  id: "losers",
                  label: `Losers (${enrichedTokens.filter((t) => (t.sinceWatchedPct ?? 0) < 0).length})`,
                },
                {
                  id: "holdings",
                  label: `Holdings (${enrichedTokens.filter((t) => t.walletBalance > 0).length})`,
                },
              ] as const
            ).map((f) => {
              const active = activeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={cn(
                    "relative px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors select-none cursor-pointer",
                    active ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="watchlistFilterTab"
                      className="absolute inset-0 rounded-full bg-accent/15 border border-accent/30"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search within watchlist */}
          <div className="relative w-full sm:w-64">
            <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs" />
            <input
              type="text"
              placeholder="Search watchlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 rounded-full bg-gradient-to-b from-[#1A1E2B] to-[#11141D] border border-border/80 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/60 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              >
                <i className="ri-close-line text-xs" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── MAIN CONTENT: TABLE OR EMPTY STATE ─── */}
      {items.length === 0 ? (
        /* Empty Watchlist State with Quick Add */
        <div className="squircle-lg bg-gradient-to-b from-[#141824] via-[#0F121A] to-[#0A0C11] border border-border/80 p-8 sm:p-14 text-center space-y-6 relative overflow-hidden">
          {/* Ambient radial blur */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto text-accent text-3xl relative z-10">
            <i className="ri-bookmark-star-line" />
          </div>

          <div className="max-w-md mx-auto space-y-2 relative z-10">
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight">Your Watchlist is Empty</h2>
            <p className="text-xs text-text-muted leading-relaxed">
              Track token price movements, calculate your since-watched returns, and monitor your
              Cookie Chain portfolio in real time.
            </p>
          </div>

          <div className="flex justify-center relative z-10">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-6 py-2.5 rounded-full bg-accent text-[#08090C] text-xs font-bold hover:bg-[#45c381] transition-all flex items-center gap-2 cursor-pointer"
            >
              <i className="ri-search-line text-sm" />
              <span>Search & Add Tokens</span>
            </button>
          </div>

          {/* Quick Add Popular Chips */}
          {suggestedTokens.length > 0 && (
            <div className="pt-8 border-t border-border/60 max-w-xl mx-auto space-y-3.5 relative z-10">
              <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                Popular on Cookie Chain
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {suggestedTokens.map((st) => (
                  <button
                    key={st.mint}
                    onClick={() => handleAddFromSearch(st)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 hover:border-accent/50 text-xs font-medium text-text-primary transition-all group cursor-pointer"
                  >
                    <TokenAvatar
                      logoUri={st.logoUri}
                      symbol={st.symbol}
                      size={20}
                      className="squircle-xs"
                    />
                    <span className="font-bold">{st.symbol}</span>
                    {st.price !== undefined && (
                      <span className="text-text-muted font-mono text-[11px]">
                        {formatPrice(st.price)}
                      </span>
                    )}
                    <i className="ri-add-line text-accent text-sm group-hover:scale-125 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ─── DESKTOP TABLE VIEW (md+) ─── */}
          <div className="hidden md:block squircle-lg bg-gradient-to-b from-[#141824] via-[#0F121A] to-[#0A0C11] border border-border/80 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[1020px]">
                {/* Table Header */}
                <div
                  style={{ gridTemplateColumns: COLS }}
                  className="grid items-center gap-x-3 px-4 py-3 bg-white/[0.03] border-b border-white/8 text-[11px] font-bold uppercase tracking-wider text-text-muted select-none"
                >
                  <span className="text-center">★</span>
                  <span>Token</span>
                  <button
                    onClick={() => handleSort("price")}
                    className="flex items-center justify-end gap-1 hover:text-text-primary text-right cursor-pointer"
                  >
                    <span>Price</span>
                    {sortKey === "price" && (
                      <i className={cn("text-[10px]", sortDir === "asc" ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                    )}
                  </button>
                  <button
                    onClick={() => handleSort("change24h")}
                    className="flex items-center justify-end gap-1 hover:text-text-primary text-right cursor-pointer"
                  >
                    <span>24h Change</span>
                    {sortKey === "change24h" && (
                      <i className={cn("text-[10px]", sortDir === "asc" ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                    )}
                  </button>
                  <span className="text-right">Added At</span>
                  <button
                    onClick={() => handleSort("sinceWatched")}
                    className="flex items-center justify-end gap-1 hover:text-text-primary text-right text-accent font-extrabold cursor-pointer"
                  >
                    <span>Since Added</span>
                    {sortKey === "sinceWatched" && (
                      <i className={cn("text-[10px]", sortDir === "asc" ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                    )}
                  </button>
                  <span className="text-right">Target</span>
                  <button
                    onClick={() => handleSort("value")}
                    className="flex items-center justify-end gap-1 hover:text-text-primary text-right cursor-pointer"
                  >
                    <span>Holdings / PnL</span>
                    {sortKey === "value" && (
                      <i className={cn("text-[10px]", sortDir === "asc" ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                    )}
                  </button>
                  <span className="text-right">Actions</span>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-white/5">
                  {filteredTokens.length === 0 ? (
                    <div className="py-12 text-center text-xs text-text-muted">
                      No tokens match your search filter.
                    </div>
                  ) : (
                    filteredTokens.map((entry) => {
                      const { item, currentPrice, priceChange24h, sinceWatchedPct, walletBalance, positionValue, unrealizedPnl, timeAgo } = entry;
                      const changeClass = deltaColorClass(priceChange24h);

                      return (
                        <div
                          key={item.mint}
                          style={{ gridTemplateColumns: COLS }}
                          onClick={() => router.push(`/token/${item.mint}`)}
                          className="grid items-center gap-x-3 px-4 h-[64px] hover:bg-[#161A24]/60 transition-colors cursor-pointer group select-none text-xs"
                        >
                          {/* Star Button (Remove) */}
                          <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => remove(item.mint)}
                              className="text-amber-400 hover:text-amber-300 p-1.5 rounded-full hover:bg-amber-400/10 transition-all hover:scale-110 cursor-pointer"
                              title="Remove from watchlist"
                            >
                              <i className="ri-star-fill text-sm" />
                            </button>
                          </div>

                          {/* Token Identity */}
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className="squircle-sm p-0.5 bg-[#181C27] border border-border/70 shrink-0">
                              <TokenAvatar
                                logoUri={item.logoUri}
                                symbol={item.symbol}
                                size={34}
                                className="squircle-xs"
                              />
                            </div>
                            <div className="min-w-0 flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-text-primary group-hover:text-accent transition-colors truncate">
                                  {item.symbol}
                                </span>
                                <span className="text-[11px] text-text-muted truncate hidden xl:inline">
                                  {item.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-text-muted font-mono mt-0.5">
                                <span>{truncateAddress(item.mint, 4)}</span>
                                <button
                                  onClick={(e) => handleCopyCA(item.mint, e)}
                                  className="hover:text-accent transition-colors p-0.5 rounded cursor-pointer flex items-center gap-1"
                                  title="Copy Contract Address"
                                >
                                  <i className={cn(copiedMint === item.mint ? "ri-check-line text-accent" : "ri-file-copy-line text-[10px]")} />
                                  {copiedMint === item.mint && <span className="text-accent text-[9px] font-bold">Copied</span>}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Current Price */}
                          <div className="text-right font-mono font-bold text-text-primary tabular-nums">
                            {currentPrice > 0 ? formatPrice(currentPrice) : <span className="text-text-muted">—</span>}
                          </div>

                          {/* 24h Change */}
                          <div className="text-right">
                            <span className={cn("font-mono font-bold tabular-nums inline-flex items-center gap-0.5", changeClass)}>
                              <i className={cn("text-[10px]", priceChange24h >= 0 ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                              <span>{formatPct(Math.abs(priceChange24h))}</span>
                            </span>
                          </div>

                          {/* Added Price */}
                          <div className="text-right flex flex-col justify-center">
                            <span className="font-mono text-text-secondary tabular-nums font-medium">
                              {item.addedPrice > 0 ? formatPrice(item.addedPrice) : "—"}
                            </span>
                            <span className="text-[10px] text-text-muted">{timeAgo}</span>
                          </div>

                          {/* Since Added Return % */}
                          <div className="text-right flex items-center justify-end">
                            {sinceWatchedPct !== null ? (
                              <div
                                className={cn(
                                  "px-2.5 py-0.5 rounded-full font-mono font-bold text-xs inline-flex items-center gap-1 tabular-nums",
                                  sinceWatchedPct >= 0
                                    ? "bg-accent/15 text-accent border border-accent/30"
                                    : "bg-error/15 text-error border border-error/30"
                                )}
                                title={`Added at ${formatPrice(item.addedPrice)} • Current ${formatPrice(currentPrice)}`}
                              >
                                <i
                                  className={cn(
                                    "text-[10px]",
                                    sinceWatchedPct >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line"
                                  )}
                                />
                                <span>{formatPct(Math.abs(sinceWatchedPct))}</span>
                              </div>
                            ) : (
                              <span className="text-text-muted text-[11px] font-mono">—</span>
                            )}
                          </div>

                          {/* Target Price */}
                          <div className="text-right font-mono">
                            {item.targetPrice ? (
                              <span
                                className={cn(
                                  "text-[11px] font-semibold",
                                  currentPrice >= item.targetPrice ? "text-accent font-bold" : "text-text-secondary"
                                )}
                              >
                                ${formatNumber(item.targetPrice, 4)}
                                {currentPrice >= item.targetPrice && " ✓"}
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(item);
                                }}
                                className="text-[10px] text-text-muted hover:text-accent transition-colors cursor-pointer"
                              >
                                + Set
                              </button>
                            )}
                          </div>

                          {/* Holdings / PnL */}
                          <div className="text-right flex flex-col justify-center font-mono">
                            {walletBalance > 0 ? (
                              <>
                                <span className="font-semibold text-text-primary tabular-nums">
                                  {formatNumber(walletBalance, 2)} {item.symbol}
                                </span>
                                <span className="text-[10px] text-text-muted tabular-nums">
                                  ${formatNumber(positionValue, 2)}
                                  {unrealizedPnl !== null && (
                                    <span className={cn("ml-1 font-semibold", deltaColorClass(unrealizedPnl))}>
                                      ({unrealizedPnl >= 0 ? "+" : ""}${formatNumber(unrealizedPnl, 2)})
                                    </span>
                                  )}
                                </span>
                              </>
                            ) : (
                              <span className="text-text-muted text-[11px]">0 {item.symbol}</span>
                            )}
                          </div>

                          {/* Actions */}
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Trade Button */}
                            <Link
                              href={`/swap?outputMint=${item.mint}`}
                              className="h-7 px-3 rounded-full bg-accent/15 text-accent border border-accent/30 hover:bg-accent hover:text-[#08090C] text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Swap on Cookieswap"
                            >
                              <i className="ri-arrow-left-right-line text-[10px]" />
                              <span>Trade</span>
                            </Link>

                            {/* Edit Notes / Target */}
                            <button
                              onClick={() => setEditingItem(item)}
                              className="w-7 h-7 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 text-text-muted hover:text-text-primary hover:border-border flex items-center justify-center transition-all cursor-pointer"
                              title="Edit Strategy Notes or Target Price"
                            >
                              <i className="ri-edit-line text-xs" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => remove(item.mint)}
                              className="w-7 h-7 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 text-text-muted hover:text-error hover:border-error/40 flex items-center justify-center transition-all cursor-pointer"
                              title="Remove"
                            >
                              <i className="ri-delete-bin-line text-xs" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="md:hidden space-y-3">
            {filteredTokens.length === 0 ? (
              <div className="py-12 text-center text-xs text-text-muted squircle-lg bg-gradient-to-b from-[#141824] via-[#0F121A] to-[#0A0C11] border border-border/80">
                No tokens match your search filter.
              </div>
            ) : (
              filteredTokens.map((entry) => {
                const { item, currentPrice, priceChange24h, sinceWatchedPct, walletBalance, positionValue, unrealizedPnl, timeAgo } = entry;
                const changeClass = deltaColorClass(priceChange24h);

                return (
                  <div
                    key={item.mint}
                    onClick={() => router.push(`/token/${item.mint}`)}
                    className="p-4 squircle-md bg-[#0E1015] border border-border space-y-3 transition-all hover:border-accent/40 cursor-pointer select-none"
                  >
                    {/* Top Row: Token Identity + Price & Delta */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            remove(item.mint);
                          }}
                          className="text-amber-400 p-1 rounded-full hover:bg-amber-400/10 cursor-pointer shrink-0"
                          title="Remove"
                        >
                          <i className="ri-star-fill text-sm" />
                        </button>
                        <div className="squircle-sm p-0.5 bg-[#181C27] border border-border/70 shrink-0">
                          <TokenAvatar logoUri={item.logoUri} symbol={item.symbol} size={32} className="squircle-xs" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-text-primary truncate">{item.symbol}</span>
                            <span className="text-[11px] text-text-muted truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
                            <span>{truncateAddress(item.mint, 4)}</span>
                            <button
                              onClick={(e) => handleCopyCA(item.mint, e)}
                              className="hover:text-accent p-0.5 cursor-pointer"
                            >
                              <i className={cn(copiedMint === item.mint ? "ri-check-line text-accent" : "ri-file-copy-line text-[10px]")} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Price & 24h delta */}
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-sm text-text-primary tabular-nums">
                          {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
                        </div>
                        <div className={cn("text-xs font-mono font-bold inline-flex items-center gap-0.5 tabular-nums", changeClass)}>
                          <i className={cn("text-[9px]", priceChange24h >= 0 ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill")} />
                          <span>{formatPct(Math.abs(priceChange24h))}</span>
                        </div>
                      </div>
                    </div>

                    {/* Mini 3-col Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-center text-xs">
                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Added At</div>
                        <div className="font-mono text-text-secondary mt-0.5 text-[11px]">
                          {item.addedPrice > 0 ? formatPrice(item.addedPrice) : "—"}
                        </div>
                        <div className="text-[9px] text-text-muted">{timeAgo}</div>
                      </div>

                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Since Added</div>
                        <div className="mt-1">
                          {sinceWatchedPct !== null ? (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full font-mono font-bold text-[10px] inline-flex items-center gap-0.5",
                                sinceWatchedPct >= 0
                                  ? "bg-accent/15 text-accent border border-accent/30"
                                  : "bg-error/15 text-error border border-error/30"
                              )}
                            >
                              <i className={cn("text-[8px]", sinceWatchedPct >= 0 ? "ri-arrow-up-line" : "ri-arrow-down-line")} />
                              {formatPct(Math.abs(sinceWatchedPct))}
                            </span>
                          ) : (
                            <span className="text-text-muted font-mono text-[11px]">—</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Target / Holdings</div>
                        <div className="font-mono text-text-primary mt-0.5 text-[11px] truncate">
                          {walletBalance > 0 ? (
                            <span className="font-bold text-accent">${formatNumber(positionValue, 2)}</span>
                          ) : item.targetPrice ? (
                            <span>${formatNumber(item.targetPrice, 4)}</span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                              }}
                              className="text-text-muted hover:text-accent text-[10px] cursor-pointer"
                            >
                              + Set
                            </button>
                          )}
                        </div>
                        {walletBalance > 0 && unrealizedPnl !== null && (
                          <div className={cn("text-[9px] font-mono", deltaColorClass(unrealizedPnl))}>
                            {unrealizedPnl >= 0 ? "+" : ""}${formatNumber(unrealizedPnl, 2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mobile Action Row */}
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/swap?outputMint=${item.mint}`}
                        className="flex-1 h-8 rounded-full bg-accent/15 text-accent border border-accent/30 hover:bg-accent hover:text-[#08090C] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <i className="ri-arrow-left-right-line text-xs" />
                        <span>Trade</span>
                      </Link>

                      <button
                        onClick={() => setEditingItem(item)}
                        className="h-8 px-3.5 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <i className="ri-edit-line text-xs" />
                        <span>Target</span>
                      </button>

                      <button
                        onClick={() => remove(item.mint)}
                        className="w-8 h-8 rounded-full bg-gradient-to-b from-[#181C26] to-[#0E1118] border border-border/80 text-text-muted hover:text-error hover:border-error/40 flex items-center justify-center transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ─── SEARCH & ADD MODAL ─── */}
      <TokenSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectToken={handleAddFromSearch}
      />

      {/* ─── EDIT NOTES & TARGET MODAL ─── */}
      <WatchlistEditModal
        item={editingItem}
        currentPrice={
          editingItem ? tokensMap[editingItem.mint.toLowerCase()]?.price : undefined
        }
        onClose={() => setEditingItem(null)}
        onSave={(mint, updates) => {
          update(mint, updates);
          setEditingItem(null);
        }}
      />
    </div>
  );
}
