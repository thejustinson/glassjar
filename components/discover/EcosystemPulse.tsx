"use client";

import { formatNumber } from "@/lib";

interface EcosystemPulseProps {
  volume24h?: number;
  liquidity?: number;
  trackedTokensCount?: number;
}

export function EcosystemPulse({
  volume24h = 0,
  liquidity = 0,
  trackedTokensCount = 0,
}: EcosystemPulseProps) {
  return (
    <div className="rounded-2xl glass-panel p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
            Cookie Chain DEX Volume
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-black font-mono text-text-primary">
              ${formatNumber(volume24h, 0)}
            </span>
            <span className="text-[10px] font-bold font-mono text-accent">
              24H
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-text-muted block">
            Active Liquidity
          </span>
          <span className="text-sm font-mono font-bold text-text-secondary block mt-0.5">
            ${formatNumber(liquidity, 0)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <div className="p-2.5 rounded-xl glass-card space-y-0.5">
          <span className="text-[10px] uppercase font-semibold text-text-muted block">
            Indexed Pairs
          </span>
          <span className="text-xs font-mono font-bold text-text-primary">
            {trackedTokensCount} Tokens
          </span>
        </div>
        <div className="p-2.5 rounded-xl glass-card space-y-0.5">
          <span className="text-[10px] uppercase font-semibold text-text-muted block">
            Finality Speed
          </span>
          <span className="text-xs font-mono font-bold text-accent flex items-center gap-1">
            <i className="ri-flashlight-fill text-[11px]" />
            <span>&lt; 400ms SVM</span>
          </span>
        </div>
      </div>

      <div className="pt-2.5 border-t border-white/[0.07] flex items-center justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          <span className="text-text-secondary font-medium text-[11px]">Mainnet Verified</span>
        </span>
        <span className="font-mono text-[10px] text-text-muted">RPC: rpc.cookiescan.io</span>
      </div>
    </div>
  );
}
