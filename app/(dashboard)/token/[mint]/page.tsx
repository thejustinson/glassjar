"use client";

/**
 * app/(dashboard)/token/[mint]/page.tsx
 * Comprehensive Token Detail & Trading Terminal page.
 * Displays interactive TradingView lightweight-chart, market stats,
 * and live Swap/Bridge execution form on the right.
 */

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { getTokenByMint, getCookPrice, type Token } from "@/lib/das";
import { PriceChart } from "@/components/charts/PriceChart";
import { SwapBridgePanel } from "@/components/swap/SwapBridgePanel";
import {
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

  const [token, setToken] = useState<Token | null>(null);
  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      <div className="space-y-6">
        <div className="h-6 w-36 bg-bg-card rounded-md animate-pulse" />
        <div className="h-20 bg-bg-card rounded-2xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-[550px] bg-bg-card rounded-2xl animate-pulse" />
          <div className="lg:col-span-4 h-[550px] bg-bg-card rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-error/10 border border-error/30 flex items-center justify-center mx-auto text-error text-2xl">
          <i className="ri-error-warning-line" />
        </div>
        <h2 className="text-lg font-bold text-text-primary">Token Not Found</h2>
        <p className="text-xs text-text-muted max-w-md mx-auto">{error}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] transition-all"
        >
          <i className="ri-arrow-left-line" />
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
      className="space-y-6"
    >
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-accent transition-colors"
        >
          <i className="ri-arrow-left-s-line text-sm" />
          <span>Back to Discover</span>
        </Link>

        <div className="flex items-center gap-2">
          <a
            href={`https://cookiescan.io/token/${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-3 rounded-full text-[11px] font-medium bg-bg-card border border-border text-text-secondary hover:text-accent hover:border-accent/40 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Explorer</span>
            <i className="ri-external-link-line text-xs" />
          </a>
        </div>
      </div>

      {/* Token Header Banner */}
      <div className="p-5 rounded-2xl bg-[#0E1015] border border-border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Token Identity */}
        <div className="flex items-center gap-4">
          <TokenAvatar
            logoUri={token.logoUri}
            symbol={token.symbol}
            size={48}
            className="rounded-2xl border border-border shadow-md"
          />

          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-text-primary tracking-tight">
                {token.name}
              </h1>
              <span className="text-sm font-semibold text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 font-mono">
                {token.symbol}
              </span>
              {token.launchpad && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary border border-secondary/30 uppercase tracking-wider">
                  Bonding Curve
                </span>
              )}
            </div>

            {/* Contract Address with Copy */}
            <div className="flex items-center gap-2 mt-1 text-xs text-text-muted font-mono">
              <span>CA: {truncateAddress(token.mint, 6)}</span>
              <button
                onClick={handleCopyMint}
                className="hover:text-accent transition-colors flex items-center gap-1"
                title="Copy full contract address"
              >
                <i className={cn(copied ? "ri-check-line text-accent" : "ri-file-copy-line")} />
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Price & Change */}
        <div className="flex items-baseline md:items-end flex-col">
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-extrabold font-mono text-text-primary tabular-nums">
              {token.price !== undefined ? formatPrice(token.price) : "—"}
            </span>
            {token.priceChange24h !== undefined && (
              <span
                className={cn(
                  "text-xs font-bold font-mono px-2 py-0.5 rounded-full",
                  token.priceChange24h >= 0
                    ? "bg-success/15 text-success"
                    : "bg-error/15 text-error"
                )}
              >
                {formatPct(token.priceChange24h)}
              </span>
            )}
          </div>
          {cookPriceInNative !== null && (
            <p className="text-xs text-text-muted font-mono mt-0.5">
              ≈ {formatNumber(cookPriceInNative, 4)} COOK
            </p>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#0E1015] border border-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Market Cap</p>
          <p className="text-base font-bold font-mono text-text-primary mt-1">
            {token.marketCap !== undefined && token.marketCap > 0
              ? formatUsd(token.marketCap, 0)
              : "—"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1015] border border-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">24h Trading Volume</p>
          <p className="text-base font-bold font-mono text-text-primary mt-1">
            {token.volume24h !== undefined && token.volume24h > 0
              ? formatUsd(token.volume24h, 0)
              : "—"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1015] border border-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Liquidity</p>
          <p className="text-base font-bold font-mono text-text-primary mt-1">
            {token.liquidity !== undefined && token.liquidity > 0
              ? formatUsd(token.liquidity, 0)
              : "—"}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#0E1015] border border-border">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Holders</p>
          <p className="text-base font-bold font-mono text-text-primary mt-1">
            {token.holderCount !== undefined && token.holderCount > 0
              ? formatNumber(token.holderCount, 0)
              : "—"}
          </p>
        </div>
      </div>

      {/* Two-Column Main Layout: Chart on Left, Swap/Bridge on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chart & Details */}
        <div className="lg:col-span-8 space-y-6">
          <PriceChart
            symbol={token.symbol}
            currentPrice={token.price}
            priceChange24h={token.priceChange24h}
            defaultMode="area"
          />

          {/* Token Profile & Contract Details */}
          <div className="p-5 rounded-2xl bg-[#0E1015] border border-border space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Token Information
            </h3>

            {token.description && (
              <p className="text-xs text-text-secondary leading-relaxed">
                {token.description}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs border-t border-border/60">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-bg-card border border-border/60">
                <span className="text-text-muted">Decimals</span>
                <span className="font-mono font-bold text-text-primary">{token.decimals}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-bg-card border border-border/60">
                <span className="text-text-muted">Network</span>
                <span className="font-semibold text-accent flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Cookie Chain SVM
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-bg-card border border-border/60 sm:col-span-2">
                <span className="text-text-muted">Mint Authority</span>
                <span className="font-mono text-[11px] text-text-secondary">
                  {truncateAddress(token.mint, 8)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Swap / Bridge Form */}
        <div className="lg:col-span-4 sticky top-20">
          <SwapBridgePanel token={token} />
        </div>
      </div>
    </motion.div>
  );
}
