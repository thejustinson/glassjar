"use client";

/**
 * components/swap/SwapBridgePanel.tsx
 * Comprehensive trading panel for the Token detail page.
 * Provides live Swap terminal matching the main Swap page layout & feel,
 * plus Hyperlane warp-route Bridge support.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getSwapQuote,
  buildSwapTransaction,
  simulateSwap,
  priceImpactSeverity,
  type SwapQuote,
} from "@/lib/cookieswap";
import {
  getConnection,
  getCookBalance,
  getTokenBalance,
  explorerTxUrl,
  NATIVE_MINT_DECIMALS,
  COOK_MINT,
  SOLANA_WARP_MINT,
} from "@/lib/chain";

// Re-export for external callers
export { COOK_MINT, SOLANA_WARP_MINT };

import {
  formatNumber,
  formatPrice,
  formatPct,
  toBaseUnits,
  fromBaseUnits,
  truncateAddress,
} from "@/lib";
import { cn } from "@/lib/utils";
import { getTokenByMint, type Token } from "@/lib/das";
import { WalletModal } from "@/components/wallet/WalletModal";
import { TokenSelectModal, NATIVE_COOK_TOKEN } from "./TokenSelectModal";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

interface SwapBridgePanelProps {
  token: Token;
  className?: string;
}

type Tab = "swap" | "bridge";
type BridgeDirection = "cookie-to-solana" | "solana-to-cookie";

export function SwapBridgePanel({ token, className }: SwapBridgePanelProps) {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>("swap");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectorTarget, setSelectorTarget] = useState<"input" | "output" | null>(null);

  // Active container focus highlight
  const [activeInput, setActiveInput] = useState<"pay" | "receive" | "bridge" | null>(null);

  // Swap Token Pair State (defaults to COOK -> token, or token -> COOK if token is COOK)
  const [inputToken, setInputToken] = useState<Token>(() => {
    return token.mint === NATIVE_COOK_TOKEN.mint
      ? {
          mint: "3Dk9AYeoMZRHg9PmA2LrxrDGyJsNPTVGbRMbNKCsEt23",
          symbol: "TRS",
          name: "Trash",
          decimals: 6,
          logoUri: "https://ipfs.filebase.io/ipfs/QmaMg8bUEKsC6qX1fmrNU8EcfYSpA78eTsGoSpYpRfMNcV",
          price: 0.000034,
        }
      : NATIVE_COOK_TOKEN;
  });

  const [outputToken, setOutputToken] = useState<Token>(token);

  // Keep outputToken in sync if the page navigates to a new token
  useEffect(() => {
    if (token.mint === NATIVE_COOK_TOKEN.mint) {
      setInputToken(token);
    } else {
      setOutputToken(token);
    }
  }, [token]);

  // Balances
  const [inputBalance, setInputBalance] = useState<number>(0);
  const [outputBalance, setOutputBalance] = useState<number>(0);
  const [cookBalance, setCookBalance] = useState<number>(0);

  // Swap Amounts & Quotes
  const [inputAmount, setInputAmount] = useState<string>("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState<number>(100); // 1.0%

  // Transaction Execution State
  const [txStatus, setTxStatus] = useState<
    "idle" | "simulating" | "signing" | "confirming" | "success" | "error"
  >("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Bridge State
  const [bridgeDirection, setBridgeDirection] = useState<BridgeDirection>("cookie-to-solana");
  const [bridgeAmount, setBridgeAmount] = useState<string>("");
  const [destAddress, setDestAddress] = useState<string>("");

  // Refresh Balances
  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setInputBalance(0);
      setOutputBalance(0);
      setCookBalance(0);
      return;
    }

    try {
      const cook = await getCookBalance(publicKey);
      setCookBalance(cook);

      if (inputToken.mint === NATIVE_COOK_TOKEN.mint) {
        setInputBalance(cook);
      } else {
        const b = await getTokenBalance(publicKey, inputToken.mint);
        setInputBalance(b?.uiAmount ?? 0);
      }

      if (outputToken.mint === NATIVE_COOK_TOKEN.mint) {
        setOutputBalance(cook);
      } else {
        const b = await getTokenBalance(publicKey, outputToken.mint);
        setOutputBalance(b?.uiAmount ?? 0);
      }
    } catch {
      // ignore
    }
  }, [publicKey, inputToken.mint, outputToken.mint]);

  useEffect(() => {
    refreshBalances();
    const interval = setInterval(refreshBalances, 15000);
    return () => clearInterval(interval);
  }, [refreshBalances]);

  // Live Swap Quote
  useEffect(() => {
    if (!inputAmount || isNaN(Number(inputAmount)) || Number(inputAmount) <= 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      setQuoteError(null);
      try {
        const rawAmount = toBaseUnits(inputAmount, inputToken.decimals).toString();
        const res = await getSwapQuote(
          inputToken.mint,
          outputToken.mint,
          rawAmount,
          slippageBps,
          publicKey?.toBase58()
        );
        setQuote(res);
      } catch (err) {
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : "Route unavailable");
      } finally {
        setQuoting(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputAmount, inputToken, outputToken, slippageBps, publicKey]);

  // Flip Tokens
  function handleInvertPair() {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount("");
  }

  // Paste CA for output token
  async function handlePasteCA() {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

      if (isBase58) {
        const found = await getTokenByMint(trimmed);
        if (found) {
          setOutputToken(found);
        } else {
          setSelectorTarget("output");
        }
      } else {
        setSelectorTarget("output");
      }
    } catch {
      setSelectorTarget("output");
    }
  }

  // Percentage shortcuts
  function handlePercent(p: number) {
    if (inputBalance <= 0) return;
    const isCook = inputToken.mint === NATIVE_COOK_TOKEN.mint;
    const reserve = isCook ? 0.05 : 0;
    const calc = (inputBalance * p) / 100;
    const finalAmount = Math.max(0, calc - reserve);
    setInputAmount(finalAmount > 0 ? finalAmount.toFixed(4) : "0");
  }

  // Execute Swap
  async function handleExecuteSwap() {
    if (!publicKey || !quote) return;
    const conn = getConnection();

    try {
      setTxStatus("simulating");
      setStatusMessage("Simulating transaction against Cookie Chain RPC...");

      // 1. Build transaction
      const tx = await buildSwapTransaction(quote, publicKey.toBase58());

      // 2. Simulation
      const simResult = await simulateSwap(conn, tx, publicKey);
      if (!simResult.ok) {
        throw new Error(simResult.error || "Simulation failed. Please adjust slippage.");
      }

      // 3. Signature
      setTxStatus("signing");
      setStatusMessage("Please sign the transaction in your wallet...");

      let signature: string;
      if (sendTransaction) {
        signature = await sendTransaction(tx, conn, { skipPreflight: false });
      } else if (signTransaction) {
        const signed = await signTransaction(tx);
        const rawTx = signed.serialize();
        signature = await conn.sendRawTransaction(rawTx, { skipPreflight: false });
      } else {
        throw new Error("Connected wallet does not support transaction signing.");
      }

      setTxSignature(signature);
      setTxStatus("confirming");
      setStatusMessage("Submitting to Cookie Chain. Awaiting confirmation...");

      // 4. Confirm
      const latestBlockhash = await conn.getLatestBlockhash();
      const confirmation = await conn.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`On-chain transaction error: ${JSON.stringify(confirmation.value.err)}`);
      }

      setTxStatus("success");
      setStatusMessage("Swap confirmed successfully!");
      setInputAmount("");
      refreshBalances();
    } catch (err) {
      setTxStatus("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected") || msg.includes("cancelled")) {
        setStatusMessage("Signature cancelled by user.");
      } else {
        setStatusMessage(msg);
      }
    }
  }

  const estimatedOut = quote ? fromBaseUnits(quote.outAmount, outputToken.decimals, 4) : "";
  const severity = quote ? priceImpactSeverity(quote.priceImpactPct) : "low";

  const inputUsd =
    inputAmount && inputToken.price ? Number(inputAmount) * inputToken.price : null;
  const outputUsd =
    estimatedOut && outputToken.price ? Number(estimatedOut) * outputToken.price : null;

  return (
    <div
      className={cn(
        "w-full rounded-3xl bg-[#0E1015] border border-border/80 shadow-2xl p-4 sm:p-5 flex flex-col gap-3 relative select-none",
        className
      )}
    >
      {/* ─── HEADER & TAB SWITCHER (Only show Bridge for bridgeable COOK) ─── */}
      <div className="flex items-center justify-between pb-1">
        {token.mint === COOK_MINT ? (
          <div className="flex items-center gap-1 bg-[#141720] p-1 rounded-full border border-border">
            <button
              onClick={() => setActiveTab("swap")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                activeTab === "swap"
                  ? "bg-accent text-[#08090C] shadow-[0_0_12px_rgba(59,178,115,0.35)]"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <i className="ri-swap-line text-xs" />
              <span>Swap</span>
            </button>

            <button
              onClick={() => setActiveTab("bridge")}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                activeTab === "bridge"
                  ? "bg-secondary text-white shadow-[0_0_12px_rgba(235,94,40,0.35)]"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <i className="ri-arrow-left-right-line text-xs" />
              <span>Bridge</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary tracking-wide">Swap</h2>
            <span className="text-[10px] font-semibold text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
              Cookieswap
            </span>
          </div>
        )}

        {/* Right Settings (Slippage Dropdown) */}
        {activeTab === "swap" && (
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-bg-card border border-border/70 text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors"
              title="Swap Settings"
            >
              <i className="ri-equalizer-line text-xs" />
            </button>

            <AnimatePresence>
              {settingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-full mt-2 z-50 w-64 p-3.5 rounded-2xl bg-[#141720] border border-border shadow-2xl space-y-3"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Slippage Tolerance
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50, 100, 250, 500].map((bps) => (
                        <button
                          key={bps}
                          onClick={() => {
                            setSlippageBps(bps);
                            setSettingsOpen(false);
                          }}
                          className={cn(
                            "h-7 rounded-lg text-xs font-mono font-bold transition-colors",
                            slippageBps === bps
                              ? "bg-accent text-[#08090C]"
                              : "bg-bg-card border border-border text-text-muted hover:text-text-primary"
                          )}
                        >
                          {bps / 100}%
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── SWAP TAB CONTENT ─── */}
      {activeTab === "swap" && (
        <div className="space-y-3">
          {/* YOU PAY CONTAINER */}
          <div
            className={cn(
              "p-4 rounded-2xl bg-[#141720] border transition-all duration-150 space-y-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
              activeInput === "pay"
                ? "border-accent ring-1 ring-accent"
                : "border-border/70 hover:border-border"
            )}
          >
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="font-semibold text-text-secondary text-xs uppercase tracking-wider">
                You Pay
              </span>
              <span className="tabular-nums font-mono text-[11px]">
                Balance: {formatNumber(inputBalance, 4)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                onFocus={() => setActiveInput("pay")}
                onBlur={() => setActiveInput(null)}
                className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted/60"
              />

              {/* Token Selector Pill */}
              <button
                onClick={() => setSelectorTarget("input")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C202B] border border-border hover:border-accent/40 text-xs font-bold flex-shrink-0 transition-colors select-none group shadow-sm"
              >
                <TokenAvatar
                  logoUri={inputToken.logoUri}
                  symbol={inputToken.symbol}
                  size={20}
                />
                <span className="text-text-primary group-hover:text-accent transition-colors font-bold">
                  {inputToken.symbol}
                </span>
                <i className="ri-arrow-down-s-line text-text-muted text-xs" />
              </button>
            </div>

            {/* USD Estimate & Percentage Pills */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-muted font-mono">
                {inputUsd !== null ? `≈ $${formatNumber(inputUsd, 2)}` : "—"}
              </span>

              <div className="flex items-center gap-1.5">
                {[25, 50, 75, 100].map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePercent(p)}
                    className="px-2 py-0.5 rounded-full bg-bg-card border border-border/70 text-[10px] font-bold text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors"
                  >
                    {p === 100 ? "MAX" : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* INVERT FLIP BUTTON */}
          <div className="flex justify-center -my-3.5 relative z-10">
            <button
              onClick={handleInvertPair}
              className="w-8 h-8 rounded-full bg-[#141720] border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent shadow-md transition-all hover:scale-105"
              title="Flip tokens"
            >
              <i className="ri-arrow-up-down-line text-xs" />
            </button>
          </div>

          {/* YOU RECEIVE CONTAINER */}
          <div
            className={cn(
              "p-4 rounded-2xl bg-[#141720] border transition-all duration-150 space-y-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
              activeInput === "receive"
                ? "border-accent ring-1 ring-accent"
                : "border-border/70 hover:border-border"
            )}
          >
            <div className="flex items-center justify-between text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-secondary text-xs uppercase tracking-wider">
                  You Receive
                </span>
                <button
                  onClick={handlePasteCA}
                  className="px-2 py-0.5 rounded-md bg-bg-card border border-border/70 hover:border-accent/40 hover:text-accent text-[10px] font-semibold text-text-muted flex items-center gap-1 transition-colors"
                  title="Paste Contract Address"
                >
                  <i className="ri-clipboard-line text-xs" />
                  <span>Paste CA</span>
                </button>
              </div>

              <span className="tabular-nums font-mono text-[11px]">
                Balance: {formatNumber(outputBalance, 4)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                readOnly
                placeholder="0.0"
                value={quoting ? "..." : estimatedOut || ""}
                onFocus={() => setActiveInput("receive")}
                onBlur={() => setActiveInput(null)}
                onClick={() => setActiveInput("receive")}
                className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted/60 cursor-default"
              />

              {/* Token Selector Pill */}
              <button
                onClick={() => setSelectorTarget("output")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C202B] border border-border hover:border-accent/40 text-xs font-bold flex-shrink-0 transition-colors select-none group shadow-sm"
              >
                <TokenAvatar
                  logoUri={outputToken.logoUri}
                  symbol={outputToken.symbol}
                  size={20}
                />
                <span className="text-text-primary group-hover:text-accent transition-colors font-bold">
                  {outputToken.symbol}
                </span>
                <i className="ri-arrow-down-s-line text-text-muted text-xs" />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-muted font-mono">
                {outputUsd !== null ? `≈ $${formatNumber(outputUsd, 2)}` : "—"}
              </span>
              {quoting && (
                <span className="text-accent flex items-center gap-1 text-[11px] font-mono">
                  <i className="ri-loader-4-line animate-spin text-xs" />
                  Routing...
                </span>
              )}
            </div>

            {quoteError && (
              <p className="text-xs text-error font-medium pt-1 flex items-center gap-1">
                <i className="ri-error-warning-line" />
                {quoteError}
              </p>
            )}
          </div>

          {/* ROUTE & SLIPPAGE DETAILS */}
          {quote && (
            <div className="p-3 rounded-xl bg-bg-card border border-border/70 text-xs space-y-1.5 text-text-muted">
              <div className="flex items-center justify-between">
                <span>Price Impact</span>
                <span
                  className={cn(
                    "font-bold font-mono text-[11px]",
                    severity === "low"
                      ? "text-success"
                      : severity === "medium"
                      ? "text-warning"
                      : "text-error"
                  )}
                >
                  {quote.priceImpactPct.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Minimum Received</span>
                <span className="font-mono text-text-primary text-[11px]">
                  {fromBaseUnits(quote.otherAmountThreshold, outputToken.decimals, 4)}{" "}
                  {outputToken.symbol}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Route Aggregator</span>
                <span className="text-text-secondary font-medium uppercase tracking-wider text-[10px]">
                  {quote._source === "cookiebox" ? "Cookiebox DAMM" : "Cookieswap / Dex"}
                </span>
              </div>
            </div>
          )}

          {/* TX STATUS BANNER */}
          {txStatus !== "idle" && (
            <div
              className={cn(
                "p-3 rounded-xl border text-xs space-y-1.5 transition-all",
                txStatus === "success" && "bg-success/10 border-success/30 text-success",
                txStatus === "error" && "bg-error/10 border-error/30 text-error",
                (txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming") &&
                  "bg-accent/10 border-accent/30 text-accent"
              )}
            >
              <div className="flex items-center gap-2 font-semibold">
                {txStatus === "success" && <i className="ri-checkbox-circle-line text-base" />}
                {txStatus === "error" && <i className="ri-error-warning-line text-base" />}
                {(txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming") && (
                  <i className="ri-loader-4-line animate-spin text-base" />
                )}
                <span>{statusMessage}</span>
              </div>

              {txSignature && (
                <a
                  href={explorerTxUrl(txSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] underline flex items-center gap-1 hover:opacity-80"
                >
                  <span>View transaction on Explorer</span>
                  <i className="ri-external-link-line" />
                </a>
              )}
            </div>
          )}

          {/* ACTION BUTTON */}
          {!connected ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-elevated text-accent border border-accent/40 hover:bg-accent/15 transition-all duration-200 flex items-center justify-center gap-2 select-none cursor-pointer"
            >
              <i className="ri-wallet-3-line text-base" />
              <span>Connect Wallet</span>
            </button>
          ) : !inputAmount || Number(inputAmount) <= 0 ? (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-border/70 text-text-muted cursor-not-allowed select-none"
            >
              Enter an amount
            </button>
          ) : Number(inputAmount) > inputBalance ? (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-error/30 text-error/80 cursor-not-allowed select-none"
            >
              Insufficient {inputToken.symbol} balance
            </button>
          ) : quoting ? (
            <button
              disabled
              className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-border/70 text-text-muted cursor-not-allowed flex items-center justify-center gap-2 select-none"
            >
              <i className="ri-loader-4-line animate-spin text-accent text-base" />
              <span>Fetching Best Route...</span>
            </button>
          ) : (
            <button
              onClick={handleExecuteSwap}
              disabled={
                !quote ||
                txStatus === "simulating" ||
                txStatus === "signing" ||
                txStatus === "confirming"
              }
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wide bg-accent text-[#08090C] hover:bg-accent-muted shadow-[0_0_20px_rgba(59,178,115,0.35)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99]"
            >
              {txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming" ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-base" />
                  <span>Processing Swap...</span>
                </>
              ) : (
                <>
                  <i className="ri-swap-line text-base" />
                  <span>
                    Swap {inputToken.symbol} to {outputToken.symbol}
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* ─── BRIDGE TAB CONTENT (Hyperlane Warp Route) ─── */}
      {activeTab === "bridge" && (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-secondary/10 border border-secondary/30 text-xs text-text-secondary space-y-1">
            <div className="flex items-center gap-1.5 text-secondary font-bold">
              <i className="ri-shield-check-line" />
              <span>Hyperlane Warp Route</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Bridge COOK 1:1 between Solana mainnet (Token-2022, 6 decimals) and Cookie Chain native (9 decimals).
            </p>
          </div>

          {/* Direction Switcher Card */}
          <div className="p-4 rounded-2xl bg-[#141720] border border-border space-y-2.5">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="font-semibold text-text-secondary uppercase tracking-wider text-xs">
                Route Direction
              </span>
              <button
                onClick={() =>
                  setBridgeDirection((d) =>
                    d === "cookie-to-solana" ? "solana-to-cookie" : "cookie-to-solana"
                  )
                }
                className="text-secondary font-bold flex items-center gap-1 hover:underline text-xs"
              >
                <i className="ri-arrow-left-right-line" />
                <span>Switch</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-text-primary px-3 py-2.5 rounded-xl bg-bg-card border border-border">
              <div className="flex items-center gap-1.5">
                <img
                  src={bridgeDirection === "cookie-to-solana" ? "/cook.jpeg" : "/solana-logo.png"}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover border border-border flex-shrink-0"
                />
                <span>{bridgeDirection === "cookie-to-solana" ? "Cookie Chain" : "Solana Mainnet"}</span>
              </div>
              <i className="ri-arrow-right-line text-secondary text-sm" />
              <div className="flex items-center gap-1.5">
                <span>{bridgeDirection === "cookie-to-solana" ? "Solana Mainnet" : "Cookie Chain"}</span>
                <img
                  src={bridgeDirection === "cookie-to-solana" ? "/solana-logo.png" : "/cook.jpeg"}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover border border-border flex-shrink-0"
                />
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div
            className={cn(
              "p-4 rounded-2xl bg-[#141720] border transition-all duration-150 space-y-2.5 focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary",
              activeInput === "bridge"
                ? "border-secondary ring-1 ring-secondary"
                : "border-border/70 hover:border-border"
            )}
          >
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span className="font-semibold text-text-secondary uppercase tracking-wider text-xs">
                Amount to Bridge
              </span>
              <span className="tabular-nums font-mono text-[11px]">
                Available: {formatNumber(cookBalance, 4)} COOK
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <input
                type="number"
                placeholder="0.0"
                value={bridgeAmount}
                onChange={(e) => setBridgeAmount(e.target.value)}
                onFocus={() => setActiveInput("bridge")}
                onBlur={() => setActiveInput(null)}
                className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted/60"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C202B] border border-border text-xs font-bold flex-shrink-0">
                <TokenAvatar symbol="COOK" size={20} />
                <span className="text-text-primary">COOK</span>
              </div>
            </div>
          </div>

          {/* Recipient Address */}
          <div className="p-4 rounded-2xl bg-[#141720] border border-border space-y-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block">
              Destination Recipient Address
            </label>
            <input
              type="text"
              placeholder={publicKey ? publicKey.toBase58() : "Solana or Cookie address..."}
              value={destAddress}
              onChange={(e) => setDestAddress(e.target.value)}
              className="w-full bg-bg-card border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-secondary"
            />
          </div>

          {/* Collateral Risk & Settlement Note */}
          <div className="p-3 rounded-xl bg-bg-card border border-border/60 text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-1 text-warning font-semibold">
              <i className="ri-time-line" />
              <span>Two-Phase Settlement</span>
            </div>
            <p>
              Transfers confirm on source chain first, then Hyperlane relayer delivers on destination within 2-5 minutes.
            </p>
          </div>

          {/* Action Button */}
          {!connected ? (
            <button
              onClick={() => setWalletModalOpen(true)}
              className="w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-wider bg-secondary text-white hover:bg-secondary-muted shadow-[0_0_15px_rgba(235,94,40,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <i className="ri-wallet-3-line text-base" />
              <span>Connect Wallet to Bridge</span>
            </button>
          ) : (
            <a
              href="https://bridge.cookiechain.wtf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-wider bg-secondary text-white hover:bg-secondary-muted shadow-[0_0_15px_rgba(235,94,40,0.4)] transition-all flex items-center justify-center gap-2"
            >
              <i className="ri-arrow-left-right-line text-base" />
              <span>Launch Hyperlane Bridge Portal</span>
              <i className="ri-external-link-line text-xs" />
            </a>
          )}
        </div>
      )}

      {/* ─── MODALS ─── */}
      <TokenSelectModal
        isOpen={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        onSelect={(t) => {
          if (selectorTarget === "input") {
            if (t.mint === outputToken.mint) {
              handleInvertPair();
            } else {
              setInputToken(t);
            }
          } else if (selectorTarget === "output") {
            if (t.mint === inputToken.mint) {
              handleInvertPair();
            } else {
              setOutputToken(t);
            }
          }
          setSelectorTarget(null);
        }}
        selectedMint={selectorTarget === "input" ? inputToken.mint : outputToken.mint}
      />

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
