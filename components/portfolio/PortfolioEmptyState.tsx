"use client";

import { useState } from "react";
import { WalletModal } from "@/components/wallet/WalletModal";

export function PortfolioEmptyState() {
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  return (
    <div className="relative py-16 px-4 flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
      {/* Background Glow */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Icon */}
      <div className="relative w-20 h-20 squircle-md bg-gradient-to-b from-[#181C27] to-[#10131B] border border-border/80 flex items-center justify-center mb-6">
        <i className="ri-wallet-3-line text-3xl text-accent" />
        <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs">
          <i className="ri-shield-check-line" />
        </span>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-3">
        Connect your wallet to track your portfolio
      </h2>
      <p className="text-sm text-text-secondary max-w-md leading-relaxed mb-8">
        View real-time Cookie Chain balances, track your total net worth in USD, monitor asset allocations, and review confirmed on-chain activity.
      </p>

      <button
        onClick={() => setWalletModalOpen(true)}
        className="h-11 px-6 rounded-full text-sm font-bold bg-accent text-[#08090C] hover:bg-[#45c381] transition-all duration-200 flex items-center gap-2 cursor-pointer select-none"
      >
        <i className="ri-wallet-line text-base" />
        <span>Connect Wallet</span>
      </button>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mt-12 text-left">
        <div className="p-4 squircle-md bg-gradient-to-b from-[#151924] to-[#0D1017] border border-border/80">
          <div className="w-8 h-8 squircle-xs bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-3">
            <i className="ri-coins-line text-base" />
          </div>
          <h4 className="text-xs font-bold text-text-primary mb-1">Real-Time Balances</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Native COOK and SPL token accounts parsed directly from live Cookie Chain RPC.
          </p>
        </div>

        <div className="p-4 squircle-md bg-gradient-to-b from-[#151924] to-[#0D1017] border border-border/80">
          <div className="w-8 h-8 squircle-xs bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-3">
            <i className="ri-pie-chart-line text-base" />
          </div>
          <h4 className="text-xs font-bold text-text-primary mb-1">Portfolio Valuation</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Automated USD net worth calculations and asset allocation percentages.
          </p>
        </div>

        <div className="p-4 squircle-md bg-gradient-to-b from-[#151924] to-[#0D1017] border border-border/80">
          <div className="w-8 h-8 squircle-xs bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-3">
            <i className="ri-history-line text-base" />
          </div>
          <h4 className="text-xs font-bold text-text-primary mb-1">On-Chain Activity</h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Confirmed wallet swaps and transfers synced directly with Cookiescan Explorer.
          </p>
        </div>
      </div>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
