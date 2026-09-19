"use client";

import { useState } from "react";
import { type WalletTransaction } from "@/lib/portfolio";
import { formatTimestamp, truncateAddress, copyToClipboard, explorerTxUrl } from "@/lib";
import { cn } from "@/lib/utils";

interface WalletActivityFeedProps {
  transactions: WalletTransaction[];
  loading: boolean;
  walletAddress: string;
}

export function WalletActivityFeed({
  transactions,
  loading,
  walletAddress,
}: WalletActivityFeedProps) {
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  async function handleCopySig(sig: string) {
    await copyToClipboard(sig);
    setCopiedSig(sig);
    setTimeout(() => setCopiedSig(null), 1500);
  }

  function formatRelativeTime(unixSecs: number): string {
    const diff = Math.floor(Date.now() / 1000) - unixSecs;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  if (loading) {
    return (
      <div className="squircle-lg bg-[#0E1015] border border-border overflow-hidden">
        <div className="p-4 border-b border-border text-xs font-bold uppercase tracking-wider text-text-muted">
          Wallet Activity
        </div>
        <div className="py-16 text-center text-xs text-text-muted space-y-2">
          <i className="ri-refresh-line animate-spin text-xl text-accent block mx-auto" />
          <p>Querying Cookiescan Explorer for wallet transactions...</p>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="squircle-lg bg-[#0E1015] border border-border p-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-[#141720] border border-border flex items-center justify-center mx-auto text-text-muted text-xl">
          <i className="ri-history-line" />
        </div>
        <h3 className="text-sm font-bold text-text-primary">No transactions found</h3>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          No confirmed on-chain transactions were found for this address on Cookie Chain yet.
        </p>
      </div>
    );
  }

  return (
    <div className="squircle-lg bg-[#0E1015] border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary">Transaction History</h3>
          <span className="text-[11px] font-semibold text-text-muted px-2 py-0.5 rounded-full bg-[#141720] border border-border">
            {transactions.length}
          </span>
        </div>
        <a
          href={`https://cookiescan.io/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline flex items-center gap-1 font-medium"
        >
          <span>View on Cookiescan</span>
          <i className="ri-external-link-line text-[11px]" />
        </a>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            style={{ gridTemplateColumns: "140px 100px 100px 1fr 140px 40px" }}
            className="grid items-center px-5 py-2.5 bg-[#0B0D13] border-b border-border text-[10px] font-bold uppercase tracking-wider text-text-muted select-none"
          >
            <span>Time</span>
            <span>Type</span>
            <span>Status</span>
            <span>Fee</span>
            <span className="text-right">Signature</span>
            <span className="text-right">Tx</span>
          </div>

          <div className="divide-y divide-border/40">
            {transactions.map((tx) => {
              const isSuccess = tx.status === "success";
              return (
                <div
                  key={tx.signature}
                  style={{ gridTemplateColumns: "140px 100px 100px 1fr 140px 40px" }}
                  className="grid items-center px-5 h-[52px] hover:bg-bg-elevated/60 transition-colors text-xs"
                >
                  {/* Time */}
                  <span
                    className="text-text-muted text-[11px] truncate"
                    title={formatTimestamp(tx.timestamp)}
                  >
                    {formatRelativeTime(tx.timestamp)}
                  </span>

                  {/* Type */}
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-bg-elevated text-text-secondary border border-border">
                      {tx.type}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-bold",
                        isSuccess ? "text-success" : "text-error"
                      )}
                    >
                      <i className={cn("text-xs", isSuccess ? "ri-checkbox-circle-fill" : "ri-close-circle-fill")} />
                      <span className="capitalize">{tx.status}</span>
                    </span>
                  </div>

                  {/* Fee */}
                  <span className="text-text-muted text-[11px] truncate">
                    {tx.fee || "0.000005 COOK"}
                  </span>

                  {/* Signature */}
                  <div className="flex items-center justify-end gap-1.5 min-w-0">
                    <span className="text-text-muted text-[11px]">
                      {truncateAddress(tx.signature, 4)}
                    </span>
                    <button
                      onClick={() => handleCopySig(tx.signature)}
                      className="text-text-muted hover:text-accent transition-colors p-0.5"
                      title="Copy transaction signature"
                    >
                      <i
                        className={cn(
                          "text-[11px]",
                          copiedSig === tx.signature ? "ri-check-line text-accent" : "ri-file-copy-line"
                        )}
                      />
                    </button>
                  </div>

                  {/* Explorer link */}
                  <div className="flex items-center justify-end">
                    <a
                      href={explorerTxUrl(tx.signature)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-text-muted hover:text-accent transition-colors"
                      title="View transaction on Cookiescan"
                    >
                      <i className="ri-external-link-line text-xs" />
                    </a>
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
