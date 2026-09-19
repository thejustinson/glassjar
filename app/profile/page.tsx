"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { TopNav } from "@/components/ui/TopNav";
import {
  fetchWalletPortfolio,
  fetchWalletTransactions,
  type PortfolioSummary,
  type WalletTransaction,
} from "@/lib/portfolio";
import { PortfolioMetrics } from "@/components/portfolio/PortfolioMetrics";
import { TokenHoldingsTable } from "@/components/portfolio/TokenHoldingsTable";
import { WalletActivityFeed } from "@/components/portfolio/WalletActivityFeed";
import { PortfolioEmptyState } from "@/components/portfolio/PortfolioEmptyState";
import { useWatchlist } from "@/lib/watchlist";
import { formatPrice, formatPct, deltaColorClass } from "@/lib";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { cn } from "@/lib/utils";

type ProfileTab = "holdings" | "activity" | "watchlist";

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey ? publicKey.toBase58() : null;

  const [activeTab, setActiveTab] = useState<ProfileTab>("holdings");
  const [portfolio, setPortfolio] = useState<PortfolioSummary>({
    totalValueUsd: 0,
    cookBalance: 0,
    cookValueUsd: 0,
    tokensValueUsd: 0,
    change24hUsd: 0,
    change24hPct: 0,
    holdings: [],
    assetCount: 0,
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(true);
  const [loadingTxs, setLoadingTxs] = useState(true);

  const { items: watchlistItems, count: watchlistCount } = useWatchlist(walletAddress);

  const loadData = useCallback(async () => {
    if (!walletAddress) return;

    setLoadingPortfolio(true);
    setLoadingTxs(true);

    try {
      const [pData, tData] = await Promise.allSettled([
        fetchWalletPortfolio(walletAddress),
        fetchWalletTransactions(walletAddress, 30),
      ]);

      if (pData.status === "fulfilled") {
        setPortfolio(pData.value);
      }
      if (tData.status === "fulfilled") {
        setTransactions(tData.value);
      }
    } finally {
      setLoadingPortfolio(false);
      setLoadingTxs(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress) {
      loadData();
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    } else {
      setLoadingPortfolio(false);
      setLoadingTxs(false);
    }
  }, [walletAddress, loadData]);

  return (
    <div className="flex flex-col min-h-dvh bg-bg">
      <TopNav />

      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {!connected || !walletAddress ? (
          <PortfolioEmptyState />
        ) : (
          <div className="space-y-6">
            {/* Top Metrics Cards */}
            <PortfolioMetrics
              summary={portfolio}
              walletAddress={walletAddress}
              loading={loadingPortfolio}
              onRefresh={loadData}
            />

            {/* Navigation Tabs Bar */}
            <div className="flex items-center justify-between border-b border-border pb-1">
              <div className="flex items-center gap-1.5">
                {/* Holdings Tab */}
                <button
                  onClick={() => setActiveTab("holdings")}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none",
                    activeTab === "holdings"
                      ? "bg-accent text-[#08090C]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  )}
                >
                  <i className="ri-wallet-3-line" />
                  <span>Holdings</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      activeTab === "holdings"
                        ? "bg-[#08090C]/20 text-[#08090C]"
                        : "bg-bg-elevated text-text-muted border border-border"
                    )}
                  >
                    {portfolio.holdings.length}
                  </span>
                </button>

                {/* Activity Tab */}
                <button
                  onClick={() => setActiveTab("activity")}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none",
                    activeTab === "activity"
                      ? "bg-accent text-[#08090C]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  )}
                >
                  <i className="ri-history-line" />
                  <span>Recent Activity</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      activeTab === "activity"
                        ? "bg-[#08090C]/20 text-[#08090C]"
                        : "bg-bg-elevated text-text-muted border border-border"
                    )}
                  >
                    {transactions.length}
                  </span>
                </button>

                {/* Watchlist Tab */}
                <button
                  onClick={() => setActiveTab("watchlist")}
                  className={cn(
                    "px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none",
                    activeTab === "watchlist"
                      ? "bg-accent text-[#08090C]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
                  )}
                >
                  <i className="ri-star-line" />
                  <span>Watchlist</span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full",
                      activeTab === "watchlist"
                        ? "bg-[#08090C]/20 text-[#08090C]"
                        : "bg-bg-elevated text-text-muted border border-border"
                    )}
                  >
                    {watchlistCount}
                  </span>
                </button>
              </div>

              {/* Quick Link to Dedicated Watchlist Page */}
              {activeTab === "watchlist" && (
                <Link
                  href="/watchlist"
                  className="text-xs text-accent hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>Open Full Watchlist</span>
                  <i className="ri-arrow-right-up-line" />
                </Link>
              )}
            </div>

            {/* Tab Views */}
            {activeTab === "holdings" && (
              <TokenHoldingsTable
                holdings={portfolio.holdings}
                loading={loadingPortfolio}
              />
            )}

            {activeTab === "activity" && (
              <WalletActivityFeed
                transactions={transactions}
                loading={loadingTxs}
                walletAddress={walletAddress}
              />
            )}

            {activeTab === "watchlist" && (
              <div className="squircle-lg bg-gradient-to-b from-[#141824] via-[#0F121A] to-[#0A0C11] border border-border/80 overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-bold text-text-primary">Saved Watchlist Tokens</h3>
                  <Link
                    href="/watchlist"
                    className="text-xs text-accent hover:underline font-semibold"
                  >
                    Manage Watchlist →
                  </Link>
                </div>

                {watchlistItems.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center mx-auto text-amber-400 text-xl">
                      <i className="ri-star-line" />
                    </div>
                    <h4 className="text-sm font-bold text-text-primary">No watched tokens yet</h4>
                    <p className="text-xs text-text-muted max-w-sm mx-auto">
                      Star tokens on the Discover page or any token chart to monitor them directly from your portfolio.
                    </p>
                    <Link
                      href="/"
                      className="inline-flex h-8 px-4 rounded-full text-xs font-bold bg-accent text-[#08090C] hover:bg-[#45c381] transition-colors items-center gap-1.5 mt-2"
                    >
                      Browse Discover Markets
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {watchlistItems.map((item) => {
                      const holding = portfolio.holdings.find(
                        (h) => h.mint.toLowerCase() === item.mint.toLowerCase()
                      );
                      const currentPrice = holding?.priceUsd || item.addedPrice;
                      const delta =
                        item.addedPrice > 0
                          ? ((currentPrice - item.addedPrice) / item.addedPrice) * 100
                          : 0;
                      const deltaClass = deltaColorClass(delta);
                      return (
                        <div
                          key={item.mint}
                          className="flex items-center justify-between px-5 py-3 hover:bg-bg-elevated/60 transition-colors text-xs"
                        >
                          <div className="flex items-center gap-3">
                            <TokenAvatar
                              logoUri={item.logoUri}
                              symbol={item.symbol}
                              size={32}
                              className="border border-border"
                            />
                            <div>
                              <Link
                                href={`/token/${item.mint}`}
                                className="font-bold text-text-primary hover:text-accent transition-colors block"
                              >
                                {item.symbol}
                              </Link>
                              <span className="text-[11px] text-text-muted">{item.name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <span className="font-semibold text-text-primary tabular-nums block">
                                {currentPrice > 0 ? formatPrice(currentPrice) : "—"}
                              </span>
                              {item.addedPrice > 0 ? (
                                <span className={cn("text-[10px] font-bold tabular-nums", deltaClass)}>
                                  {formatPct(delta, 2)} since added
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/swap?output=${item.mint}`}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-accent/15 text-accent border border-accent/25 hover:bg-accent hover:text-[#08090C] transition-all"
                              >
                                Swap
                              </Link>
                              <Link
                                href={`/token/${item.mint}`}
                                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                              >
                                <i className="ri-line-chart-line text-sm" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
