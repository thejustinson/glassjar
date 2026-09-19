"use client";

/**
 * app/(dashboard)/bridge/page.tsx
 * High-density GlassJar Bridge Page for Cookie Chain ↔ Solana Mainnet.
 * Features focused Bridge Terminal on the left and streamlined Route Analytics on the right.
 */

import { useState } from "react";
import { BridgeTerminal } from "@/components/bridge/BridgeTerminal";
import {
  COOKIE_WARP_PROGRAM_ID,
  SOLANA_WARP_PROGRAM_ID,
  SOLANA_WARP_MINT,
  OFFICIAL_BRIDGE_URL,
} from "@/lib/bridge";
import { truncateAddress, copyToClipboard } from "@/lib";

export default function BridgePage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(text: string, id: string) {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="relative min-h-[82vh] flex flex-col items-center justify-center py-6 px-4 sm:px-6 select-none">
      {/* Subtle dotted grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(142, 146, 160, 0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full max-w-4xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* ─── LEFT: COMPACT BRIDGE TERMINAL ─── */}
        <div className="w-full max-w-[480px]">
          <BridgeTerminal />
        </div>

        {/* ─── RIGHT: STREAMLINED ROUTE ANALYTICS ─── */}
        <div className="w-full max-w-[480px] lg:w-80 flex flex-col gap-3">
          {/* Metrics Card */}
          <div className="p-4 squircle-lg bg-[#0E1015] border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <i className="ri-pulse-line text-secondary text-sm" />
                <span>Route Analytics</span>
              </span>
              <span className="text-[10px] text-accent font-semibold px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span>Peg 1:1</span>
              </span>
            </div>

            {/* 2x2 Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 squircle-md bg-[#141720] border border-border">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Avg Relayer
                </span>
                <span className="font-mono font-bold text-text-primary text-xs">
                  ~1–3 mins
                </span>
              </div>

              <div className="p-2.5 squircle-md bg-[#141720] border border-border">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Interchain Fee
                </span>
                <span className="font-mono font-bold text-text-primary text-xs">
                  ~0.01 COOK
                </span>
              </div>

              <div className="p-2.5 squircle-md bg-[#141720] border border-border">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Cookie Reserve
                </span>
                <span className="font-mono font-bold text-accent text-xs">
                  75.0M COOK
                </span>
              </div>

              <div className="p-2.5 squircle-md bg-[#141720] border border-border">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Solana Reserve
                </span>
                <span className="font-mono font-bold text-purple-400 text-xs">
                  120.0M COOK
                </span>
              </div>
            </div>
          </div>

          {/* Verified Contracts Card */}
          <div className="p-4 squircle-lg bg-[#0E1015] border border-border space-y-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block">
              Verified Contracts
            </span>

            <div className="space-y-1.5 text-xs">
              <div className="p-2 squircle-sm bg-[#141720] border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-text-muted block">Cookie Warp Program</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(COOKIE_WARP_PROGRAM_ID, 4)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(COOKIE_WARP_PROGRAM_ID, "cookie")}
                  className="px-2 py-1 rounded bg-[#0B0D13] border border-border text-[10px] text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                >
                  {copiedId === "cookie" ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="p-2 squircle-sm bg-[#141720] border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-text-muted block">Solana Warp Program</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(SOLANA_WARP_PROGRAM_ID, 4)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(SOLANA_WARP_PROGRAM_ID, "solana")}
                  className="px-2 py-1 rounded bg-[#0B0D13] border border-border text-[10px] text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                >
                  {copiedId === "solana" ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="p-2 squircle-sm bg-[#141720] border border-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-text-muted block">Solana Token-2022 Mint</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(SOLANA_WARP_MINT, 4)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(SOLANA_WARP_MINT, "mint")}
                  className="px-2 py-1 rounded bg-[#0B0D13] border border-border text-[10px] text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                >
                  {copiedId === "mint" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Flow Timeline */}
          <div className="p-4 squircle-lg bg-[#0E1015] border border-border space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted block">
              Settlement Steps
            </span>

            <div className="space-y-1.5 text-[11px] text-text-secondary">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-secondary/20 text-secondary font-bold text-[9px] flex items-center justify-center">
                  1
                </span>
                <span>Sign transaction on source chain (~1s)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-secondary/20 text-secondary font-bold text-[9px] flex items-center justify-center">
                  2
                </span>
                <span>Hyperlane relayer verifies message</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-secondary/20 text-secondary font-bold text-[9px] flex items-center justify-center">
                  3
                </span>
                <span>Funds unlocked on destination (~2 min)</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60">
              <a
                href={OFFICIAL_BRIDGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-secondary hover:underline flex items-center justify-between font-semibold"
              >
                <span>Official Hyperlane Portal</span>
                <i className="ri-external-link-line" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
