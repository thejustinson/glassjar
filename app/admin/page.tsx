"use client";

/**
 * app/admin/page.tsx
 * Password-protected administrative analytics dashboard for GlassJar.
 * Features:
 * - Secure server-side password authentication with 24-hour session cookie.
 * - Live KPI metrics (connected wallets, swap & bridge transactions, volume, telemetry events).
 * - Comprehensive data views: Recent Transactions, Connected Wallets, Event Telemetry, and Popular Tokens.
 * - High-density GlassJar terminal aesthetic with DM Sans typography and #FBFF6C secondary accents.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatNumber, truncateAddress, copyToClipboard } from "@/lib";
import { cn } from "@/lib/utils";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

interface AnalyticsData {
  metrics: {
    totalWallets: number;
    newWallets24h: number;
    totalTx: number;
    totalSwaps: number;
    totalBridges: number;
    totalEvents: number;
    totalWatchlists: number;
    totalCookVolume: number;
    totalSolVolume: number;
  };
  activeWallets: Array<{
    address: string;
    first_connected_at: string;
    last_seen_at: string;
    connection_count: number;
    wallet_name?: string | null;
  }>;
  recentTx: Array<{
    signature: string;
    wallet_address: string;
    tx_type: string;
    source_chain: string;
    dest_chain?: string;
    input_symbol?: string;
    input_amount?: number;
    output_symbol?: string;
    output_amount?: number;
    status: string;
    created_at: string;
  }>;
  recentEvents: Array<{
    id: string;
    event_type: string;
    wallet_address?: string;
    metadata?: any;
    created_at: string;
  }>;
  popularTokens: Array<{
    symbol: string;
    mint: string;
    name?: string;
    logo_uri?: string;
    count: number;
  }>;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"tx" | "wallets" | "events" | "tokens">("tx");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check existing session
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth");
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(data.authenticated === true);
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch analytics data
  const loadAnalytics = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAnalytics();
      const interval = setInterval(loadAnalytics, 20000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, loadAnalytics]);

  // Handle Login
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAuthError(data.error || "Incorrect password");
        return;
      }

      setIsAuthenticated(true);
      setPassword("");
    } catch {
      setAuthError("Failed to authenticate. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
      setIsAuthenticated(false);
      setAnalytics(null);
    } catch {
      // ignore
    }
  }

  async function handleCopy(text: string, id: string) {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Initial session check loading
  if (isAuthenticated === null) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <i className="ri-loader-4-line text-2xl text-secondary animate-spin" />
      </div>
    );
  }

  // ─── LOGIN SCREEN ───
  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 select-none">
        <div className="w-full max-w-md rounded-3xl bg-[#0E1015] border border-border/80 shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary mb-1">
              <i className="ri-shield-user-line text-2xl" />
            </div>
            <h1 className="text-xl font-black text-text-primary tracking-wide">
              GlassJar Analytics
            </h1>
            <p className="text-xs text-text-muted">
              Enter the administrator password to view platform metrics and user telemetry.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider block mb-1.5">
                Admin Password
              </label>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full bg-bg-card border border-border/80 rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:border-secondary outline-none transition-colors"
              />
            </div>

            {authError && (
              <div className="p-2.5 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2">
                <i className="ri-error-warning-line shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading || !password}
              className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide bg-secondary text-black hover:bg-secondary-muted disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
            >
              {authLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <i className="ri-lock-unlock-line text-base" />
                  <span>Access Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center">
            <Link
              href="/"
              className="text-xs text-text-muted hover:text-text-primary transition-colors inline-flex items-center gap-1"
            >
              <i className="ri-arrow-left-line text-xs" />
              <span>Return to Terminal</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── AUTHENTICATED DASHBOARD ───
  const metrics = analytics?.metrics;

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4 space-y-6 select-none">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-text-primary tracking-wide">
              GlassJar Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-bold uppercase tracking-wider">
              Admin Console
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time on-chain transaction logs, wallet engagement, and platform telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAnalytics}
            disabled={loadingData}
            className="px-3 py-1.5 rounded-xl bg-bg-card border border-border hover:border-secondary text-xs text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-all cursor-pointer"
            title="Refresh metrics"
          >
            <i className={cn("ri-refresh-line", loadingData && "animate-spin text-secondary")} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-error/10 border border-error/30 text-xs text-error hover:bg-error/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <i className="ri-logout-box-r-line" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ─── TOP KPI METRICS GRID ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Wallets */}
        <div className="p-4 rounded-2xl bg-[#0E1015] border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-bold uppercase tracking-wider text-[10px]">Connected Wallets</span>
            <i className="ri-wallet-3-line text-secondary text-base" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-text-primary">
              {metrics ? formatNumber(metrics.totalWallets, 0) : "—"}
            </span>
            {metrics && metrics.newWallets24h > 0 && (
              <span className="text-[11px] font-mono text-accent font-semibold">
                +{metrics.newWallets24h} 24h
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-muted block">Unique addresses seen</span>
        </div>

        {/* Total Transactions */}
        <div className="p-4 rounded-2xl bg-[#0E1015] border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-bold uppercase tracking-wider text-[10px]">Total Transactions</span>
            <i className="ri-exchange-dollar-line text-accent text-base" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-text-primary">
              {metrics ? formatNumber(metrics.totalTx, 0) : "—"}
            </span>
            <span className="text-[11px] font-mono text-text-muted">
              {metrics ? `${metrics.totalSwaps}s / ${metrics.totalBridges}b` : "—"}
            </span>
          </div>
          <span className="text-[10px] text-text-muted block">Swaps & Warp transfers</span>
        </div>

        {/* Total Volume */}
        <div className="p-4 rounded-2xl bg-[#0E1015] border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-bold uppercase tracking-wider text-[10px]">Platform Volume</span>
            <i className="ri-line-chart-line text-secondary text-base" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-text-primary">
              {metrics ? formatNumber(metrics.totalCookVolume, 0) : "—"}
            </span>
            <span className="text-[11px] font-bold text-secondary font-mono">COOK</span>
          </div>
          <span className="text-[10px] text-text-muted block">
            +{metrics ? formatNumber(metrics.totalSolVolume, 2) : "0"} SOL bridged
          </span>
        </div>

        {/* Platform Events */}
        <div className="p-4 rounded-2xl bg-[#0E1015] border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span className="font-bold uppercase tracking-wider text-[10px]">Telemetry Events</span>
            <i className="ri-pulse-line text-purple-400 text-base" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-text-primary">
              {metrics ? formatNumber(metrics.totalEvents, 0) : "—"}
            </span>
            <span className="text-[11px] font-mono text-text-muted">
              {metrics ? `${metrics.totalWatchlists} watches` : "—"}
            </span>
          </div>
          <span className="text-[10px] text-text-muted block">Actions logged in Supabase</span>
        </div>
      </div>

      {/* ─── DATA VIEWS TAB SELECTOR ─── */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0E1015] border border-border">
        <button
          onClick={() => setActiveTab("tx")}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
            activeTab === "tx"
              ? "bg-secondary text-black shadow-sm"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <i className="ri-history-line text-sm" />
          <span>Recent Transactions ({analytics?.recentTx?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("wallets")}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
            activeTab === "wallets"
              ? "bg-secondary text-black shadow-sm"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <i className="ri-wallet-3-line text-sm" />
          <span>Active Wallets ({analytics?.activeWallets?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("events")}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
            activeTab === "events"
              ? "bg-secondary text-black shadow-sm"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <i className="ri-pulse-line text-sm" />
          <span>Event Telemetry ({analytics?.recentEvents?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("tokens")}
          className={cn(
            "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
            activeTab === "tokens"
              ? "bg-secondary text-black shadow-sm"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <i className="ri-star-line text-sm" />
          <span>Popular Tokens ({analytics?.popularTokens?.length || 0})</span>
        </button>
      </div>

      {/* ─── TAB 1: RECENT TRANSACTIONS TABLE ─── */}
      {activeTab === "tx" && (
        <div className="rounded-3xl bg-[#0E1015] border border-border shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">Recent Transactions</h2>
            <span className="text-[11px] text-text-muted">Showing latest 50 on-chain records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141720] text-[10px] uppercase font-bold text-text-muted border-b border-border/70">
                <tr>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4">Input</th>
                  <th className="py-3 px-4">Output</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {!analytics || analytics.recentTx.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-text-muted">
                      No transactions recorded yet in the database.
                    </td>
                  </tr>
                ) : (
                  analytics.recentTx.map((tx) => {
                    const isBridge = tx.tx_type === "bridge";
                    const isCookieSource = tx.source_chain === "cookie";
                    const explorerUrl = isCookieSource
                      ? `https://cookiescan.io/tx/${tx.signature}`
                      : `https://solscan.io/tx/${tx.signature}`;

                    return (
                      <tr key={tx.signature} className="hover:bg-bg-elevated/50 transition-colors">
                        <td className="py-3 px-4 text-text-muted font-mono text-[11px]">
                          {new Date(tx.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              isBridge
                                ? "bg-secondary/15 text-secondary border border-secondary/30"
                                : "bg-accent/15 text-accent border border-accent/30"
                            )}
                          >
                            {tx.tx_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-text-secondary">
                          <button
                            onClick={() => handleCopy(tx.wallet_address, tx.signature)}
                            className="hover:text-text-primary cursor-pointer flex items-center gap-1"
                            title="Copy wallet address"
                          >
                            <span>{truncateAddress(tx.wallet_address, 4)}</span>
                            {copiedId === tx.signature ? (
                              <i className="ri-check-line text-accent" />
                            ) : (
                              <i className="ri-file-copy-line text-[10px] opacity-60" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-text-primary">
                          {tx.input_amount !== undefined ? formatNumber(tx.input_amount, 2) : "—"}{" "}
                          <span className="text-[10px] text-text-muted">{tx.input_symbol || ""}</span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-text-primary">
                          {tx.output_amount !== undefined ? formatNumber(tx.output_amount, 2) : "—"}{" "}
                          <span className="text-[10px] text-text-muted">{tx.output_symbol || ""}</span>
                        </td>
                        <td className="py-3 px-4 text-text-muted text-[11px]">
                          {isBridge ? `${tx.source_chain} → ${tx.dest_chain}` : "Cookie Chain"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize",
                              tx.status === "confirmed" || tx.status === "delivered"
                                ? "bg-accent/10 text-accent border border-accent/20"
                                : "bg-error/10 text-error border border-error/20"
                            )}
                          >
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <a
                            href={explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-secondary hover:underline inline-flex items-center gap-1 text-[11px]"
                          >
                            <span>{truncateAddress(tx.signature, 4)}</span>
                            <i className="ri-external-link-line text-[10px]" />
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: ACTIVE WALLETS TABLE ─── */}
      {activeTab === "wallets" && (
        <div className="rounded-3xl bg-[#0E1015] border border-border shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">Connected Wallets</h2>
            <span className="text-[11px] text-text-muted">Showing latest 50 active addresses</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141720] text-[10px] uppercase font-bold text-text-muted border-b border-border/70">
                <tr>
                  <th className="py-3 px-4">Wallet Address</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Sessions</th>
                  <th className="py-3 px-4">First Seen</th>
                  <th className="py-3 px-4 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {!analytics || analytics.activeWallets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-text-muted">
                      No connected wallets recorded yet.
                    </td>
                  </tr>
                ) : (
                  analytics.activeWallets.map((w) => (
                    <tr key={w.address} className="hover:bg-bg-elevated/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-text-primary">
                        <button
                          onClick={() => handleCopy(w.address, w.address)}
                          className="hover:text-secondary cursor-pointer flex items-center gap-1.5"
                          title="Copy full address"
                        >
                          <span>{truncateAddress(w.address, 6)}</span>
                          {copiedId === w.address ? (
                            <i className="ri-check-line text-accent" />
                          ) : (
                            <i className="ri-file-copy-line text-[10px] opacity-60" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {w.wallet_name || "Nightly / Solana"}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-accent">
                        {w.connection_count}
                      </td>
                      <td className="py-3 px-4 text-text-muted font-mono text-[11px]">
                        {new Date(w.first_connected_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right text-text-muted font-mono text-[11px]">
                        {new Date(w.last_seen_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: EVENT TELEMETRY STREAM ─── */}
      {activeTab === "events" && (
        <div className="rounded-3xl bg-[#0E1015] border border-border shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border/80 flex items-center justify-between">
            <h2 className="text-sm font-bold text-text-primary">Platform Telemetry Stream</h2>
            <span className="text-[11px] text-text-muted">Live event logs from user actions</span>
          </div>

          <div className="divide-y divide-border/60">
            {!analytics || analytics.recentEvents.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-xs">
                No telemetry events recorded yet.
              </div>
            ) : (
              analytics.recentEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3.5 hover:bg-bg-elevated/40 transition-colors flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-bg-card border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                      {evt.event_type.includes("wallet") ? (
                        <i className="ri-wallet-3-line text-secondary" />
                      ) : evt.event_type.includes("swap") ? (
                        <i className="ri-swap-line text-accent" />
                      ) : evt.event_type.includes("bridge") ? (
                        <i className="ri-arrow-left-right-line text-purple-400" />
                      ) : (
                        <i className="ri-pulse-line text-text-muted" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-primary capitalize">
                          {evt.event_type.replace(/_/g, " ")}
                        </span>
                        {evt.wallet_address && (
                          <span className="text-[10px] text-text-muted font-mono">
                            by {truncateAddress(evt.wallet_address, 4)}
                          </span>
                        )}
                      </div>
                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <span className="text-[10px] text-text-muted font-mono block truncate">
                          {JSON.stringify(evt.metadata)}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
                    {new Date(evt.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: POPULAR TOKENS ─── */}
      {activeTab === "tokens" && (
        <div className="rounded-3xl bg-[#0E1015] border border-border shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-primary">Most Tracked Tokens</h2>
              <p className="text-xs text-text-muted">
                Tokens most frequently saved to user watchlists across wallets.
              </p>
            </div>
            <span className="text-xs font-mono text-secondary font-bold">
              {analytics?.popularTokens?.length || 0} Assets
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!analytics || analytics.popularTokens.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-text-muted text-xs">
                No watchlist tracking data yet.
              </div>
            ) : (
              analytics.popularTokens.map((t, idx) => (
                <div
                  key={t.mint}
                  className="p-3.5 rounded-2xl bg-[#141720] border border-border/80 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-text-muted w-4">
                      #{idx + 1}
                    </span>
                    <TokenAvatar symbol={t.symbol} logoUri={t.logo_uri} size={28} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-text-primary text-xs truncate">
                          {t.symbol}
                        </span>
                        {t.name && (
                          <span className="text-[10px] text-text-muted truncate">
                            {t.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-muted font-mono block">
                        {truncateAddress(t.mint, 4)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold font-mono text-accent">
                      {t.count}
                    </span>
                    <span className="text-[10px] text-text-muted block">saves</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
