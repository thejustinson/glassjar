"use client";

import { useMemo } from "react";
import { formatNumber } from "@/lib";

interface EcosystemPulseProps {
  volume24h?: number;
  liquidity?: number;
  trackedTokensCount?: number;
}

export function EcosystemPulse({
  volume24h = 1115,
  liquidity = 6944,
  trackedTokensCount = 82,
}: EcosystemPulseProps) {
  // Mini simulated volume histogram bars for the sleek Quantix aesthetic
  const bars = useMemo(() => {
    const values = [28, 42, 65, 30, 85, 45, 95, 60, 40, 75, 55, 90, 70, 80, 100, 60, 45, 80];
    return values.map((val, idx) => ({
      heightPct: val,
      isGreen: idx % 3 !== 0,
    }));
  }, []);

  return (
    <div className="rounded-2xl glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
            Cookie Chain Activity
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-black font-mono text-text-primary">
              ${formatNumber(volume24h, 0)}
            </span>
            <span className="text-[11px] font-bold font-mono text-accent">
              +18.4% 24h
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            Active Liquidity
          </span>
          <span className="text-xs font-mono font-bold text-text-secondary block mt-0.5">
            ${formatNumber(liquidity, 0)}
          </span>
        </div>
      </div>

      {/* Mini Volume Bar Histogram */}
      <div className="h-14 w-full flex items-end justify-between gap-1 pt-2 px-1">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all duration-300"
            style={{
              height: `${bar.heightPct}%`,
              backgroundColor: bar.isGreen ? "#3BB273" : "#E53935",
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="pt-2.5 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span>{trackedTokensCount} Tokens Indexed</span>
        </span>
        <span className="font-mono text-[10px] text-text-muted">Sub-second SVM block time</span>
      </div>
    </div>
  );
}
