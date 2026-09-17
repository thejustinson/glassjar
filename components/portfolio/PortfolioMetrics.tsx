"use client";

import { useState } from "react";
import { type PortfolioSummary } from "@/lib/portfolio";
import { formatNumber, formatUsd, formatPct, deltaColorClass, truncateAddress, copyToClipboard, explorerAddressUrl } from "@/lib";
import { cn } from "@/lib/utils";
import { FundWalletModal } from "./FundWalletModal";

interface PortfolioMetricsProps {
  summary: PortfolioSummary;
  walletAddress: string;
  loading: boolean;
  onRefresh: () => void;
}

export function PortfolioMetrics({
  summary,
  walletAddress,
  loading,
  onRefresh,
}: PortfolioMetricsProps) {
  const [copied, setCopied] = useState(false);
  const [fundModalOpen, setFundModalOpen] = useState(false);

  async function handleCopy() {
    await copyToClipboard(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const pnlDeltaClass = deltaColorClass(summary.change24hPct);

  return (
    <div className="space-y-4">
      {/* Top Header Row: Title + Connected Wallet Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">Portfolio</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time balance, token allocation, and transaction ledger on Cookie Chain
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Fund Wallet Button */}
          <button
            onClick={() => setFundModalOpen(true)}
            className="h-9 px-3.5 rounded-full text-xs font-bold bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_12px_rgba(59,178,115,0.3)] transition-all flex items-center gap-1.5 cursor-pointer select-none"
          >
            <i className="ri-qr-code-line text-sm" />
            <span>Fund Wallet</span>
          </button>

          {/* Wallet Address Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-card border border-border text-xs text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="font-semibold text-text-primary">
              {truncateAddress(walletAddress, 4)}
            </span>
            <button
              onClick={handleCopy}
              className="text-text-muted hover:text-accent transition-colors p-0.5 cursor-pointer"
              title="Copy wallet address"
            >
              <i className={cn("text-xs", copied ? "ri-check-line text-accent" : "ri-file-copy-line")} />
            </button>
            <a
              href={explorerAddressUrl(walletAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-accent transition-colors p-0.5"
              title="View on Cookiescan Explorer"
            >
              <i className="ri-external-link-line text-xs" />
            </a>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-9 w-9 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh balances"
          >
            <i className={cn("ri-refresh-line text-sm", loading && "animate-spin text-accent")} />
          </button>
        </div>
      </div>

      <FundWalletModal
        isOpen={fundModalOpen}
        onClose={() => setFundModalOpen(false)}
        walletAddress={walletAddress}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Net Worth */}
        <div className="p-4 rounded-2xl bg-bg-card border border-border/80 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Total Net Worth</span>
            <i className="ri-wallet-line text-accent text-sm" />
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {formatUsd(summary.totalValueUsd, 2)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5 text-xs">
            <span className={cn("font-bold tabular-nums", pnlDeltaClass)}>
              {formatPct(summary.change24hPct, 2)}
            </span>
            <span className="text-[11px] text-text-muted tabular-nums">
              ({summary.change24hUsd >= 0 ? "+" : ""}{formatUsd(summary.change24hUsd, 2)} 24h)
            </span>
          </div>
        </div>

        {/* Card 2: Native COOK Holdings */}
        <div className="p-4 rounded-2xl bg-bg-card border border-border/80">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Native COOK</span>
            <span className="text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              L1 GAS
            </span>
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {formatNumber(summary.cookBalance, 3)}
          </p>
          <p className="text-xs text-text-secondary mt-1.5 tabular-nums">
            ≈ {formatUsd(summary.cookValueUsd, 2)}
          </p>
        </div>

        {/* Card 3: SPL Token Holdings */}
        <div className="p-4 rounded-2xl bg-bg-card border border-border/80">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Token Assets</span>
            <i className="ri-coins-line text-text-muted text-sm" />
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {formatUsd(summary.tokensValueUsd, 2)}
          </p>
          <p className="text-xs text-text-secondary mt-1.5 tabular-nums">
            Across {Math.max(0, summary.assetCount - (summary.cookBalance > 0 ? 1 : 0))} SPL token{summary.assetCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Card 4: Total Assets Count */}
        <div className="p-4 rounded-2xl bg-bg-card border border-border/80">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Active Assets</span>
            <i className="ri-pie-chart-line text-text-muted text-sm" />
          </div>
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {summary.assetCount}
          </p>
          <p className="text-xs text-text-muted mt-1.5">
            {summary.assetCount > 0 ? "With positive on-chain balance" : "No tokens found in wallet"}
          </p>
        </div>
      </div>
    </div>
  );
}
