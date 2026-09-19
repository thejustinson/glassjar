"use client";

/**
 * app/(dashboard)/token/[mint]/page.tsx
 * Comprehensive Token Detail & Trading Terminal page.
 * Displays interactive TradingView lightweight-chart, market stats,
 * and live Swap/Bridge execution form on the right.
 */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { getTokenByMint, getCookPrice, type Token } from "@/lib/das";
import { PriceChart } from "@/components/charts/PriceChart";
import { SwapCard } from "@/components/swap/SwapCard";
import { NATIVE_COOK_TOKEN } from "@/components/swap/TokenSelectModal";
import { TokenSecurityCard } from "@/components/token/TokenSecurityCard";
import { TokenActivityTabs } from "@/components/token/TokenActivityTabs";
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

interface TokenPageProps {
  params: Promise<{ mint: string }>;
}

export default function TokenPage({ params }: TokenPageProps) {
  const resolvedParams = use(params);
  const mint = resolvedParams.mint;

  const { publicKey } = useWallet();
  const { isWatched, toggle } = useWatchlist(publicKey?.toBase58());

  const [token, setToken] = useState<Token | null>(null);
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const watched = token ? isWatched(token.mint) : false;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([getTokenByMint(mint), getCookPrice()])
      .then(([t, cookPrice]) => {
        if (!active) return;
        if (!t) {
          setError(`Token with contract address "${truncateAddress(mint, 6)}" not found.`);
        } else {
          setToken(t);
          setCookUsd(cookPrice);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load token details");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mint]);

  async function handleCopyMint() {
    if (!token) return;
    await copyToClipboard(token.mint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="h-8 w-44 glass-pill rounded-full animate-pulse" />
        <div className="h-28 squircle-lg glass-panel animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 squircle-md glass-card animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[550px] squircle-lg glass-panel animate-pulse" />
          <div className="lg:col-span-4 h-[550px] squircle-lg glass-panel animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/30 flex items-center justify-center mx-auto text-error text-2xl shadow-lg">
          <i className="ri-error-warning-line" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Token Not Found</h2>
        <p className="text-xs text-text-muted leading-relaxed">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-10 px-6 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all cursor-pointer"
        >
          <i className="ri-arrow-left-line text-sm" />
          <span>Back to Discover</span>
        </Link>
      </div>
    );
  }

  const changeClass = deltaColorClass(token.priceChange24h ?? 0);
  const cookPriceInNative =
    token.price && cookUsd && cookUsd > 0 ? token.price / cookUsd : null;

  return (
    <motion.div
      variants={variants.fadeIn}
      initial="hidden"
      animate="visible"
      className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6"
    >
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold glass-pill border border-white/8 text-text-secondary hover:text-accent hover:border-accent/40 transition-all shadow-sm cursor-pointer"
        >
          <i className="ri-arrow-left-line text-sm" />
          <span>Back to Discover</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Watchlist Toggle */}
          <button
            onClick={() =>
              toggle({
                mint: token.mint,
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                logoUri: token.logoUri,
                price: token.price,
              })
            }
            className={cn(
              "h-8 px-3.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 select-none shadow-sm cursor-pointer",
              watched
                ? "bg-amber-400/15 text-amber-400 border border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                : "glass-pill border border-white/8 text-text-secondary hover:text-amber-400 hover:border-amber-400/40"
            )}
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <i className={cn(watched ? "ri-star-fill text-amber-400 text-xs" : "ri-star-line text-xs")} />
            <span>{watched ? "Watching" : "Add to Watchlist"}</span>
          </button>

          <a
            href={`https://cookiescan.io/token/${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3.5 rounded-full text-xs font-medium glass-pill border border-white/8 text-text-secondary hover:text-accent hover:border-accent/40 transition-all inline-flex items-center gap-1.5 shadow-sm"
          >
            <span>Explorer</span>
            <i className="ri-external-link-line text-xs" />
          </a>
        </div>
      </div>

      {/* Hero Token Header Card */}
      <div className="p-5 sm:p-6 squircle-lg glass-panel relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl border border-white/10">
        {/* Ambient background glow */}
        <div className="absolute -right-16 -top-16 w-60 h-60 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        {/* Token Identity */}
        <div className="flex items-center gap-4 sm:gap-5 relative z-10 min-w-0">
          <div className="squircle-md p-1 bg-white/[0.04] border border-white/10 shadow-lg shrink-0">
            <TokenAvatar
              logoUri={token.logoUri}
              symbol={token.symbol}
              size={52}
              className="squircle-sm"
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight truncate">
                {token.name}
              </h1>
              <span className="text-xs font-extrabold text-accent px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 font-mono">
                {token.symbol}
              </span>
              {token.launchpad && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 uppercase tracking-wider">
                  Bonding Curve
                </span>
              )}
            </div>

            {/* Contract Address with Copy */}
            <div className="flex items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full glass-pill border border-white/8 text-xs text-text-muted font-mono">
                <span className="text-text-secondary font-bold text-[10px] uppercase">CA</span>
                <span>{truncateAddress(token.mint, 6)}</span>
                <button
                  onClick={handleCopyMint}
                  className="text-text-muted hover:text-accent transition-colors flex items-center gap-1 cursor-pointer pl-1.5 border-l border-white/10"
                  title="Copy full contract address"
                >
                  <i className={cn(copied ? "ri-check-line text-accent" : "ri-file-copy-line text-xs")} />
                  <span className={cn("text-[11px]", copied ? "text-accent font-bold" : "")}>
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Price & Percentage */}
        <div className="flex items-baseline md:items-end flex-col relative z-10 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-text-primary tabular-nums tracking-tight">
              {token.price !== undefined ? formatPrice(token.price) : "—"}
            </span>
            {token.priceChange24h !== undefined && (
              <span
                className={cn(
                  "text-xs font-bold font-mono px-2.5 py-1 rounded-full",
                  token.priceChange24h >= 0
                    ? "bg-success/15 text-success border border-success/30"
                    : "bg-error/15 text-error border border-error/30"
                )}
              >
                {formatPct(token.priceChange24h)}
              </span>
            )}
          </div>
          {cookPriceInNative !== null && (
            <p className="text-xs text-text-muted font-mono mt-1 font-medium">
              ≈ {formatNumber(cookPriceInNative, 4)} COOK
            </p>
          )}
        </div>
      </div>

      {/* 4 Metric Highlight Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Market Cap */}
        <div className="p-4 sm:p-4.5 squircle-md glass-card border border-white/8 transition-all hover:border-accent/30 group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-muted">Market Cap</p>
            <i className="ri-pie-chart-2-line text-xs text-accent/60 group-hover:text-accent transition-colors" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-text-primary mt-1.5 tabular-nums">
            {token.marketCap !== undefined && token.marketCap > 0
              ? formatUsd(token.marketCap, 0)
              : "—"}
          </p>
        </div>

        {/* 2. 24h Volume */}
        <div className="p-4 sm:p-4.5 squircle-md glass-card border border-white/8 transition-all hover:border-accent/30 group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-muted">24h Volume</p>
            <i className="ri-bar-chart-box-line text-xs text-accent/60 group-hover:text-accent transition-colors" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-text-primary mt-1.5 tabular-nums">
            {token.volume24h !== undefined && token.volume24h > 0
              ? formatUsd(token.volume24h, 0)
              : "—"}
          </p>
        </div>

        {/* 3. Liquidity */}
        <div className="p-4 sm:p-4.5 squircle-md glass-card border border-white/8 transition-all hover:border-accent/30 group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-muted">Liquidity</p>
            <i className="ri-drop-line text-xs text-accent/60 group-hover:text-accent transition-colors" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-text-primary mt-1.5 tabular-nums">
            {token.liquidity !== undefined && token.liquidity > 0
              ? formatUsd(token.liquidity, 0)
              : "—"}
          </p>
        </div>

        {/* 4. Holders */}
        <div className="p-4 sm:p-4.5 squircle-md glass-card border border-white/8 transition-all hover:border-accent/30 group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-text-muted">Holders</p>
            <i className="ri-user-star-line text-xs text-accent/60 group-hover:text-accent transition-colors" />
          </div>
          <p className="text-base sm:text-lg font-bold font-mono text-text-primary mt-1.5 tabular-nums">
            {token.mint.toLowerCase() === "so11111111111111111111111111111111111111112"
              ? "20"
              : token.holderCount !== undefined && token.holderCount > 0
                ? formatNumber(token.holderCount, 0)
                : "—"}
          </p>
        </div>
      </div>

      {/* Two-Column Main Layout: Chart & Activity on Left, Swap & Token Info on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chart, Activity Tabs, and Details */}
        <div className="lg:col-span-8 space-y-6">
          <PriceChart
            symbol={token.symbol}
            currentPrice={token.price}
            priceChange24h={token.priceChange24h}
            defaultMode="area"
          />

          {/* Activity Tabs: Transactions, My Holdings, Holders List, Top Traders */}
          <TokenActivityTabs token={token} />

          {/* Token Profile & Contract Details */}
          <div className="p-5 sm:p-6 squircle-md glass-card border border-white/8 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
              <i className="ri-information-line text-accent" />
              <span>About {token.name}</span>
            </h3>

            {token.description && (
              <p className="text-xs text-text-secondary leading-relaxed font-normal">
                {token.description}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-white/8">
              <div className="flex items-center justify-between p-3 rounded-xl glass-pill border border-white/8">
                <span className="text-text-muted">Decimals</span>
                <span className="font-mono font-bold text-text-primary">{token.decimals}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl glass-pill border border-white/8">
                <span className="text-text-muted">Network</span>
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Cookie Chain SVM
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl glass-pill border border-white/8 sm:col-span-2">
                <span className="text-text-muted">Contract Address (Mint)</span>
                <span className="font-mono text-[11px] text-text-secondary">
                  {truncateAddress(token.mint, 8)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Swap Form + Token Info Audit Grid */}
        <div className="lg:col-span-4 space-y-5 sticky top-20">
          <SwapCard
            initialInputToken={token.mint === NATIVE_COOK_TOKEN.mint ? token : undefined}
            initialOutputToken={token.mint === NATIVE_COOK_TOKEN.mint ? undefined : token}
            compact
          />
          <TokenSecurityCard token={token} />
        </div>
      </div>
    </motion.div>
  );
}
