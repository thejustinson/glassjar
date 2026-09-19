"use client";

import { useMemo } from "react";
import { type Token } from "@/lib/das";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { formatPrice, formatPct, deltaColorClass } from "@/lib";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

interface LiveHighlightsProps {
  tokens: Token[];
  cookPrice?: number;
  onTradeToken?: (token: Token) => void;
  selectedMint?: string;
}

export function LiveHighlights({
  tokens,
  cookPrice = 0.000075,
  onTradeToken,
  selectedMint,
}: LiveHighlightsProps) {
  // 1. Highlight 1: Native COOK
  const cookCardToken: Token = useMemo(() => {
    const found = tokens.find(
      (t) => t.symbol.toUpperCase() === "COOK" || t.name.toLowerCase().includes("cookie")
    );
    if (found) return found;
    return {
      mint: "native-cook",
      symbol: "COOK",
      name: "Cookie Chain Gas",
      decimals: 9,
      price: cookPrice || 0.000075,
      priceChange24h: 3.42,
      volume24h: 1115,
      marketCap: 450000,
    };
  }, [tokens, cookPrice]);

  // 2. Highlight 2: Top Gainer
  const topGainerToken: Token = useMemo(() => {
    const sorted = [...tokens].sort((a, b) => (b.priceChange24h || 0) - (a.priceChange24h || 0));
    return sorted[0] || cookCardToken;
  }, [tokens, cookCardToken]);

  // 3. Highlight 3: High Volume / Trending
  const trendingToken: Token = useMemo(() => {
    const sorted = [...tokens]
      .filter((t) => t.mint !== cookCardToken.mint && t.mint !== topGainerToken.mint)
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    return sorted[0] || tokens[1] || cookCardToken;
  }, [tokens, cookCardToken, topGainerToken]);

  const highlightCards = [
    { token: cookCardToken, badge: "Native Gas" },
    { token: topGainerToken, badge: "Top Gainer" },
    { token: trendingToken, badge: "Hot Asset" },
  ];

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <h2 className="text-base font-bold text-text-primary tracking-tight">
            Live Crypto Updates
          </h2>
          <span className="text-[11px] text-text-muted font-normal">· Cookie Chain</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-text-muted px-2.5 py-1 rounded-lg bg-bg-card border border-border">
            USD / 24H
          </span>
        </div>
      </div>

      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {highlightCards.map(({ token, badge }) => {
          const isPos = (token.priceChange24h || 0) >= 0;
          const isSelected = selectedMint === token.mint;

          return (
            <div
              key={token.mint + badge}
              onClick={() => onTradeToken?.(token)}
              className={cn(
                "group relative rounded-2xl glass-panel p-4 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between",
                "hover:border-accent/50 hover:bg-white/[0.06] hover:shadow-[0_12px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)]",
                isSelected && "border-accent/70 ring-1 ring-accent/30 bg-white/[0.06]"
              )}
            >
              {/* Card Header: Avatar, Symbol, Category Pill & Trade Icon */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TokenAvatar
                    symbol={token.symbol}
                    logoUri={token.logoUri}
                    size={36}
                    className="border border-white/10 group-hover:border-accent/40 transition-colors"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-text-primary truncate">
                        {token.symbol}
                      </span>
                      <span className="text-[10px] font-medium text-text-muted">/USD</span>
                    </div>
                    <span className="text-[11px] text-text-muted truncate block max-w-[120px]">
                      {token.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md glass-pill text-text-muted">
                    {badge}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTradeToken?.(token);
                    }}
                    title="Quick Trade"
                    className="w-7 h-7 rounded-lg glass-pill hover:bg-accent/20 hover:text-accent hover:border-accent/30 text-text-muted flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <i className="ri-swap-line text-xs" />
                  </button>
                </div>
              </div>

              {/* Price & Change Row */}
              <div className="mt-4 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    Spot Price
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 font-mono leading-none",
                      isPos
                        ? "bg-accent/15 text-accent border border-accent/25"
                        : "bg-error/15 text-error border border-error/25"
                    )}
                  >
                    <i
                      className={cn(
                        "text-[8px]",
                        isPos ? "ri-arrow-up-s-fill" : "ri-arrow-down-s-fill"
                      )}
                    />
                    <span>{formatPct(token.priceChange24h || 0)}</span>
                  </span>
                </div>

                <div className="mt-1">
                  <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-text-primary">
                    {formatPrice(token.price || 0)}
                  </span>
                </div>
              </div>

              {/* Mini Sparkline Area Chart at Bottom */}
              <div className="w-full h-12 mt-1 -mb-1">
                <MiniSparkline
                  delta={token.priceChange24h || 0}
                  seed={token.mint}
                  height={48}
                  width={240}
                  showArea={true}
                  className="w-full h-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
