"use client";

/**
 * app/(dashboard)/bridge/page.tsx
 * Bridge Page for Cookie Chain ↔ Solana Mainnet via Hyperlane Warp Route.
 * Features focused Bridge Terminal on the left and technical route details,
 * contract references, and collateral metrics on the right.
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
import { cn } from "@/lib/utils";

export default function BridgePage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(text: string, id: string) {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="relative min-h-[82vh] flex flex-col items-center justify-center py-6 select-none">
      {/* Subtle dotted grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(142, 146, 160, 0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8">
        {/* ─── LEFT: BRIDGE TERMINAL ─── */}
        <div className="w-full max-w-[520px]">
          <BridgeTerminal />
        </div>

        {/* ─── RIGHT: TECHNICAL ROUTE & SAFETY DETAILS ─── */}
        <div className="w-full max-w-[520px] lg:w-96 flex flex-col gap-4">
          {/* Header Card */}
          <div className="p-5 rounded-3xl bg-[#0E1015] border border-border/80 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-secondary font-bold text-sm">
              <i className="ri-shield-keyhole-line text-base" />
              <span>Hyperlane Warp Architecture</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              The official bridge utilizes a decentralized <strong>Hyperlane warp route</strong> to seamlessly transfer COOK 1:1 between Cookie Chain native and Solana mainnet.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
              <div className="p-2.5 rounded-xl bg-bg-card border border-border/60">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Cookie Chain
                </span>
                <span className="font-mono font-bold text-accent text-xs">
                  9 Decimals (Native)
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-bg-card border border-border/60">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">
                  Solana Mainnet
                </span>
                <span className="font-mono font-bold text-purple-400 text-xs">
                  6 Decimals (Token-2022)
                </span>
              </div>
            </div>
          </div>

          {/* Program Contracts Card */}
          <div className="p-5 rounded-3xl bg-[#0E1015] border border-border/80 shadow-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center justify-between">
              <span>Warp Route Contracts</span>
              <span className="text-[10px] text-accent font-mono font-semibold">Verified</span>
            </h3>

            <div className="space-y-2 text-xs">
              {/* Cookie Program */}
              <div className="p-2.5 rounded-xl bg-bg-card border border-border/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-text-muted block">Cookie Chain Program</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(COOKIE_WARP_PROGRAM_ID, 6)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(COOKIE_WARP_PROGRAM_ID, "cookie")}
                  className="px-2 py-1 rounded bg-bg-elevated text-[11px] text-text-muted hover:text-accent transition-colors"
                >
                  {copiedId === "cookie" ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Solana Program */}
              <div className="p-2.5 rounded-xl bg-bg-card border border-border/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-text-muted block">Solana Warp Program</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(SOLANA_WARP_PROGRAM_ID, 6)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(SOLANA_WARP_PROGRAM_ID, "solana")}
                  className="px-2 py-1 rounded bg-bg-elevated text-[11px] text-text-muted hover:text-accent transition-colors"
                >
                  {copiedId === "solana" ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Solana Mint */}
              <div className="p-2.5 rounded-xl bg-bg-card border border-border/60 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-text-muted block">Solana Token-2022 Mint</span>
                  <span className="font-mono text-text-primary text-[11px]">
                    {truncateAddress(SOLANA_WARP_MINT, 6)}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(SOLANA_WARP_MINT, "mint")}
                  className="px-2 py-1 rounded bg-bg-elevated text-[11px] text-text-muted hover:text-accent transition-colors"
                >
                  {copiedId === "mint" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Settlement Guide */}
          <div className="p-5 rounded-3xl bg-[#0E1015] border border-border/80 shadow-xl space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              How Settlement Works
            </h3>

            <ol className="space-y-2 text-xs text-text-secondary leading-relaxed list-decimal list-inside">
              <li>
                <strong>Dispatch:</strong> Transaction signs and submits on the source SVM chain (~1s finality).
              </li>
              <li>
                <strong>Relayer Delivery:</strong> Off-chain Hyperlane relayer detects the message and releases collateral on the destination chain (~2–5 minutes).
              </li>
              <li>
                <strong>Recipient Crediting:</strong> Destination wallet is credited with exact 1:1 COOK tokens.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
