"use client";

import { useState } from "react";
import Link from "next/link";
import { type PortfolioHolding } from "@/lib/portfolio";
import { formatNumber, formatPrice, formatUsd, formatPct, deltaColorClass, truncateAddress, copyToClipboard } from "@/lib";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { cn } from "@/lib/utils";

interface TokenHoldingsTableProps {
  holdings: PortfolioHolding[];
  loading: boolean;
}

export function TokenHoldingsTable({ holdings, loading }: TokenHoldingsTableProps) {
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  async function handleCopyMint(mint: string) {
    await copyToClipboard(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1500);
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">
        <div className="p-4 border-b border-border text-xs font-bold uppercase tracking-wider text-text-muted">
          Holdings
        </div>
        <div className="py-16 text-center text-xs text-text-muted space-y-2">
          <i className="ri-refresh-line animate-spin text-xl text-accent block mx-auto" />
          <p>Scanning wallet accounts on Cookie Chain...</p>
        </div>
      </div>
    );
  }

  if (holdings.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-bg-card p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center mx-auto text-text-muted text-xl">
          <i className="ri-inbox-line" />
        </div>
        <h3 className="text-sm font-bold text-text-primary">No tokens found</h3>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          This wallet currently holds no COOK or SPL tokens on Cookie Chain. Explore live markets or bridge funds to get started.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Link
            href="/"
            className="h-8 px-4 rounded-full text-xs font-bold bg-accent text-[#08090C] hover:bg-[#45c381] transition-colors inline-flex items-center gap-1.5"
          >
            <span>Discover Markets</span>
            <i className="ri-arrow-right-line" />
          </Link>
          <Link
            href="/bridge"
            className="h-8 px-4 rounded-full text-xs font-semibold bg-bg-elevated border border-border text-text-primary hover:border-accent/40 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Bridge Funds</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-bg-card overflow-hidden shadow-xl">
      {/* Table Header Bar */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">Asset Holdings</h3>
          <span className="text-[11px] font-semibold text-text-muted px-2 py-0.5 rounded-full bg-bg-elevated border border-border">
            {holdings.length}
          </span>
        </div>
        <span className="text-[11px] text-text-muted">Direct on-chain read</span>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Column Titles */}
          <div
            style={{ gridTemplateColumns: "minmax(220px, 2.5fr) 130px 120px 100px 120px 110px 120px" }}
            className="grid items-center px-5 py-2.5 bg-bg/50 border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-muted select-none"
          >
            <span>Asset</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="text-right">Value</span>
            <span className="text-right">Allocation</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/40">
            {holdings.map((item) => {
              const changeClass = deltaColorClass(item.change24h ?? 0);
              return (
                <div
                  key={item.mint}
                  style={{ gridTemplateColumns: "minmax(220px, 2.5fr) 130px 120px 100px 120px 110px 120px" }}
                  className="grid items-center px-5 h-[60px] hover:bg-bg-elevated/60 transition-colors text-xs"
                >
                  {/* Asset info */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <TokenAvatar
                      logoUri={item.logoUri}
                      symbol={item.symbol}
                      size={32}
                      className="border border-border flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/token/${item.mint}`}
                          className="font-bold text-text-primary hover:text-accent transition-colors truncate"
                        >
                          {item.symbol}
                        </Link>
                        {item.isNativeCook ? (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 flex-shrink-0">
                            Native
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-text-muted uppercase px-1 py-0.5 rounded bg-bg-elevated border border-border flex-shrink-0">
                            SPL
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted truncate">
                        <span className="truncate">{item.name}</span>
                        {!item.isNativeCook && (
                          <button
                            onClick={() => handleCopyMint(item.mint)}
                            className="hover:text-text-primary transition-colors p-0.5"
                            title={`Copy mint: ${item.mint}`}
                          >
                            <i className={cn("text-[10px]", copiedMint === item.mint ? "ri-check-line text-accent" : "ri-file-copy-line")} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="text-right">
                    <span className="font-semibold text-text-primary tabular-nums">
                      {formatNumber(item.balance, item.balance < 1 ? 4 : 2)}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <span className="text-text-secondary tabular-nums">
                      {item.priceUsd > 0 ? formatPrice(item.priceUsd) : "—"}
                    </span>
                  </div>

                  {/* 24h Change */}
                  <div className="text-right">
                    {item.change24h !== undefined ? (
                      <span className={cn("font-bold tabular-nums text-[11px]", changeClass)}>
                        {formatPct(item.change24h, 2)}
                      </span>
                    ) : (
                      <span className="text-text-muted text-[11px]">—</span>
                    )}
                  </div>

                  {/* Value USD */}
                  <div className="text-right">
                    <span className="font-bold text-text-primary tabular-nums">
                      {item.valueUsd > 0 ? formatUsd(item.valueUsd, 2) : "$0.00"}
                    </span>
                  </div>

                  {/* Allocation % */}
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1.5 rounded-full bg-bg-elevated overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-accent rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, item.allocationPct))}%` }}
                      />
                    </div>
                    <span className="font-semibold text-text-secondary tabular-nums text-[11px] min-w-[36px] text-right">
                      {item.allocationPct.toFixed(1)}%
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5">
                    <Link
                      href={item.isNativeCook ? "/swap" : `/swap?output=${item.mint}`}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-accent/15 text-accent border border-accent/25 hover:bg-accent hover:text-[#08090C] transition-all duration-150"
                      title="Swap this token"
                    >
                      Swap
                    </Link>
                    <Link
                      href={`/token/${item.mint}`}
                      className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                      title="View market chart"
                    >
                      <i className="ri-line-chart-line text-sm" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
