"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  // Dynamic Highlight Cards based on live market activity (Most Traded, Top Gainer, Hot Asset)
  const highlightCards = useMemo(() => {
    if (!tokens || tokens.length === 0) return [];

    // Prioritize active tokens with established prices or volume
    const activePool = tokens.filter((t) => (t.price ?? 0) > 0);
    const pool = activePool.length >= 3 ? activePool : tokens;

    if (pool.length === 0) return [];

    // 1. Most Traded (Highest 24h volume)
    const sortedByVolume = [...pool].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    const topVolume = sortedByVolume[0] || pool[0];

    // 2. Top Gainer (Highest 24h percentage gain, distinct from topVolume)
    const gainerCandidates = pool.filter((t) => t.mint !== topVolume.mint);
    const sortedByGainers = [...gainerCandidates].sort(
      (a, b) => (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0)
    );
    const topGainer = sortedByGainers[0] || pool[1] || topVolume;

    // 3. Hot Asset (Next most active token by volume & market cap, distinct from #1 and #2)
    const remaining = pool.filter(
      (t) => t.mint !== topVolume.mint && t.mint !== topGainer.mint
    );
    const sortedByHot = [...remaining].sort(
      (a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0) || (b.marketCap ?? 0) - (a.marketCap ?? 0)
    );
    const hotAsset = sortedByHot[0] || remaining[0] || pool[2] || topVolume;

    return [
      { token: topVolume, badge: "Most Traded" },
      { token: topGainer, badge: "Top Gainer" },
      { token: hotAsset, badge: "Hot Asset" },
    ];
  }, [tokens]);

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

      {/* 3-Card Grid (Horizontal Snap-Scroll on Mobile, Multi-col on Desktop) */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-3.5 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 md:grid-cols-3 sm:overflow-visible no-scrollbar">
        {highlightCards.map(({ token, badge }) => {
          const isPos = (token.priceChange24h || 0) >= 0;
          const isSelected = selectedMint === token.mint;

          return (
            <div
              key={token.mint + badge}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify(token));
                e.dataTransfer.setData("text/plain", token.mint);
                e.dataTransfer.effectAllowed = "copyMove";
              }}
              onClick={() => router.push(`/token/${token.mint}`)}
              className={cn(
                "w-[84vw] sm:w-auto shrink-0 sm:shrink snap-center",
                "group relative squircle glass-panel p-4 transition-all duration-200 cursor-pointer xl:cursor-grab active:cursor-grabbing overflow-hidden flex flex-col justify-between min-h-[165px]",
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
                    className="border border-white/10 group-hover:border-accent/40 transition-colors flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-base text-text-primary tracking-tight whitespace-nowrap">
                        {token.symbol}
                      </span>
                      <span
                        className="hidden xl:inline-block opacity-0 group-hover:opacity-60 transition-opacity text-text-muted text-[10px]"
                        title="Drag token to swap terminal"
                      >
                        <i className="ri-drag-move-2-line" />
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted block truncate max-w-[140px]">
                      {token.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full glass-pill text-text-muted">
                    {badge}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTradeToken?.(token);
                    }}
                    title="Quick Trade"
                    className="w-7 h-7 rounded-full glass-pill hover:bg-accent/20 hover:text-accent hover:border-accent/30 text-text-muted flex items-center justify-center transition-colors cursor-pointer"
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
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 font-mono leading-none",
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
