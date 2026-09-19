"use client";

import { useMemo } from "react";
import { type Token } from "@/lib/das";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { formatPrice, formatPct, deltaColorClass } from "@/lib";
import { cn } from "@/lib/utils";

interface MarketTickerTapeProps {
  tokens: Token[];
  onSelectToken?: (token: Token) => void;
}

export function MarketTickerTape({ tokens, onSelectToken }: MarketTickerTapeProps) {
  // Take top 12 tokens and duplicate for an infinite marquee loop
  const marqueeItems = useMemo(() => {
    const slice = tokens.slice(0, 12);
    if (slice.length === 0) return [];
    // Duplicate 2x for seamless wrap
    return [...slice, ...slice];
  }, [tokens]);

  if (marqueeItems.length === 0) return null;

  return (
    <div className="relative w-full overflow-hidden py-2 border-b border-white/[0.08] bg-[#090b10]/70 backdrop-blur-xl select-none group">
      {/* Left gradient fade mask */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-bg via-bg/80 to-transparent z-10"
        aria-hidden="true"
      />

      {/* Right gradient fade mask */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-bg via-bg/80 to-transparent z-10"
        aria-hidden="true"
      />

      {/* Infinite scrolling marquee track */}
      <div className="animate-marquee flex items-center gap-x-4">
        {marqueeItems.map((t, idx) => {
          return (
            <button
              key={`${t.mint}-${idx}`}
              onClick={() => onSelectToken?.(t)}
              className="flex items-center gap-2 py-1 px-2.5 rounded-full glass-pill hover:bg-white/[0.08] transition-all cursor-pointer whitespace-nowrap group/item shrink-0"
              title={`Quick Trade ${t.symbol}`}
            >
              <TokenAvatar symbol={t.symbol} logoUri={t.logoUri} size={18} />
              <span className="font-bold text-text-primary text-xs group-hover/item:text-accent transition-colors">
                {t.symbol}
              </span>
              <span className="font-mono text-text-secondary text-[11px]">
                {formatPrice(t.price || 0)}
              </span>
              <span
                className={cn(
                  "font-mono text-[10px] font-bold flex items-center gap-0.5",
                  deltaColorClass(t.priceChange24h || 0)
                )}
              >
                {formatPct(t.priceChange24h || 0)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
