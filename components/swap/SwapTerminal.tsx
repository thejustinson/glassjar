"use client";

/**
 * components/swap/SwapTerminal.tsx
 * Focused Cookie Chain Swap Terminal card.
 * Features You Pay/You Receive cards with active container outline, "Paste CA" button,
 * percentage quick-fill, token selector pills, live routing via Cookieswap/Cookiebox,
 * and GlassJar native color palette.
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
  confirmTransactionPolling,
} from "@/lib/chain";
import {
  formatNumber,
  formatPrice,
  toBaseUnits,
  fromBaseUnits,
} from "@/lib";
import { cn } from "@/lib/utils";
import { getTokenByMint, type Token } from "@/lib/das";
import { TokenSelectModal, NATIVE_COOK_TOKEN } from "./TokenSelectModal";
import { WalletModal } from "@/components/wallet/WalletModal";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { recordTransactionDb } from "@/lib/supabase";

export interface SwapTerminalProps {
  inputToken: Token;
  outputToken: Token;
  onSelectInputToken: (token: Token) => void;
  onSelectOutputToken: (token: Token) => void;
  onInvertPair: () => void;
  className?: string;
}

export function SwapTerminal({
  inputToken,
  outputToken,
  onSelectInputToken,
  onSelectOutputToken,
  onInvertPair,
  className,
}: SwapTerminalProps) {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet();

  const [selectorTarget, setSelectorTarget] = useState<"input" | "output" | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<"pay" | "receive" | null>(null);

  // Balances
  const [inputBalance, setInputBalance] = useState<number>(0);
  const [outputBalance, setOutputBalance] = useState<number>(0);

  // Input & Output values
  const [inputAmount, setInputAmount] = useState<string>("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [slippageBps, setSlippageBps] = useState<number>(100); // 1.0%

  // Execution Status
  const [txStatus, setTxStatus] = useState<
    "idle" | "simulating" | "signing" | "confirming" | "success" | "error"
  >("idle");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Balance Refresh
  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setInputBalance(0);
      setOutputBalance(0);
      return;
    }

    try {
      if (inputToken.mint === NATIVE_COOK_TOKEN.mint) {
        const bal = await getCookBalance(publicKey);
        setInputBalance(bal);
      } else {
        const tBal = await getTokenBalance(publicKey, inputToken.mint);
        setInputBalance(tBal?.uiAmount ?? 0);
      }

      if (outputToken.mint === NATIVE_COOK_TOKEN.mint) {
        const bal = await getCookBalance(publicKey);
        setOutputBalance(bal);
      } else {
        const tBal = await getTokenBalance(publicKey, outputToken.mint);
        setOutputBalance(tBal?.uiAmount ?? 0);
      }
    } catch {
      // ignore
    }
  }, [publicKey, inputToken.mint, outputToken.mint]);

  useEffect(() => {
    refreshBalances();
    const interval = setInterval(refreshBalances, 12000);
    return () => clearInterval(interval);
  }, [refreshBalances]);

  // Live Quote Fetching
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
        setQuoteError(err instanceof Error ? err.message : "Route not available");
      } finally {
        setQuoting(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputAmount, inputToken, outputToken, slippageBps, publicKey]);

  // Paste CA functionality
  async function handlePasteCA() {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

      if (isBase58) {
        const found = await getTokenByMint(trimmed);
        if (found) {
          onSelectOutputToken(found);
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

  // Swap Execution Flow
  async function handleSwap() {
    if (!publicKey || !quote) return;
    const conn = getConnection();

    try {
      setTxStatus("simulating");
      setStatusMessage("Simulating transaction against Cookie Chain RPC...");

      // 1. Build transaction
      const tx = await buildSwapTransaction(quote, publicKey.toBase58());

      // 2. Preflight Simulation
      const simResult = await simulateSwap(conn, tx, publicKey);
      if (!simResult.ok) {
        throw new Error(simResult.error || "Simulation failed. Please adjust slippage.");
      }

      // 3. Wallet Signature
      setTxStatus("signing");
      setStatusMessage(
        "Awaiting wallet signature. You are transacting on Cookie Chain — ensure Nightly is set to Cookie Chain (in Nightly: Settings → Network → switch to Cookie) to approve."
      );

      let signature: string;
      if (signTransaction) {
        const signed = await signTransaction(tx);
        const rawTx = signed.serialize();
        signature = await conn.sendRawTransaction(rawTx, {
          skipPreflight: false,
          maxRetries: 3,
        });
      } else if (sendTransaction) {
        signature = await sendTransaction(tx, conn, { skipPreflight: false });
      } else {
        throw new Error("Connected wallet does not support transaction signing.");
      }

      setTxSignature(signature);
      setTxStatus("confirming");
      setStatusMessage("Submitting to Cookie Chain. Awaiting confirmation...");

      // 4. Ultra-fast HTTP RPC Confirmation
      const confirmation = await confirmTransactionPolling(conn, signature);
      if (!confirmation.ok) {
        throw new Error(`On-chain transaction error: ${JSON.stringify(confirmation.err)}`);
      }

      setTxStatus("success");
      setStatusMessage("Swap confirmed successfully!");

      // Record to Supabase
      recordTransactionDb({
        signature,
        wallet_address: publicKey.toBase58(),
        tx_type: "swap",
        source_chain: "cookie",
        input_mint: inputToken.mint,
        input_symbol: inputToken.symbol,
        input_amount: Number(inputAmount),
        output_mint: outputToken.mint,
        output_symbol: outputToken.symbol,
        output_amount: estimatedOut ? Number(estimatedOut) : undefined,
        status: "confirmed",
      });

      setInputAmount("");
      refreshBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("User rejected") ||
        msg.includes("cancelled") ||
        msg.includes("rejected the request") ||
        (err as any)?.name === "WalletSignTransactionError"
      ) {
        setTxStatus("idle");
        setStatusMessage("Signature cancelled by user.");
      } else {
        setTxStatus("error");
        setStatusMessage(msg);
      }
    }
  }

  function handlePercent(p: number) {
    if (inputBalance <= 0) return;
    const isCook = inputToken.mint === NATIVE_COOK_TOKEN.mint;
    const reserve = isCook ? 0.05 : 0;
    const calc = (inputBalance * p) / 100;
    const finalAmount = Math.max(0, calc - reserve);
    setInputAmount(finalAmount > 0 ? finalAmount.toFixed(4) : "0");
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
        "w-full max-w-[480px] rounded-3xl bg-[#0E1015] border border-border/80 shadow-2xl p-4 sm:p-5 flex flex-col gap-3 relative",
        className
      )}
    >
      {/* ─── TOP HEADER & SETTINGS ─── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-text-primary tracking-wide">Swap</h2>
          <span className="text-[10px] font-semibold text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            Cookieswap
          </span>
        </div>

        {/* Right Settings */}
        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-bg-card border border-border/70 text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors"
            title="Swap Settings"
          >
            <i className="ri-equalizer-line text-sm" />
          </button>

          {/* Settings Dropdown */}
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
      </div>

      {/* ─── YOU PAY CONTAINER ─── */}
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

        {/* Value in USD & Quick Percentage Pills */}
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

      {/* ─── INVERT FLIP BUTTON ─── */}
      <div className="flex justify-center -my-3.5 relative z-10">
        <button
          onClick={onInvertPair}
          className="w-8 h-8 rounded-full bg-[#141720] border border-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent shadow-md transition-all hover:scale-105"
          title="Flip tokens"
        >
          <i className="ri-arrow-up-down-line text-xs" />
        </button>
      </div>

      {/* ─── YOU RECEIVE CONTAINER ─── */}
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
            {/* "Paste CA" button */}
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

      {/* Route & Slippage Details */}
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
        </div>
      )}

      {/* Transaction Status Box */}
      {txStatus !== "idle" && (
        <div
          className={cn(
            "p-3 rounded-xl border text-xs space-y-1.5",
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
              <span>View on Explorer</span>
              <i className="ri-external-link-line" />
            </a>
          )}
        </div>
      )}

      {/* ─── MAIN CONNECT / SWAP BUTTON (GlassJar native theme) ─── */}
      {!connected ? (
        <button
          onClick={() => setWalletModalOpen(true)}
          className="w-full h-14 rounded-2xl text-base font-bold tracking-wide bg-accent text-[#08090C] hover:bg-accent-muted shadow-[0_0_20px_rgba(59,178,115,0.35)] transition-all flex items-center justify-center gap-2 mt-1"
        >
          <span>Connect Wallet</span>
        </button>
      ) : txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming" ? (
        <button
          disabled
          className="w-full h-14 rounded-2xl text-base font-bold tracking-wide bg-accent/80 text-[#08090C] cursor-wait flex items-center justify-center gap-2 mt-1 shadow-[0_0_20px_rgba(59,178,115,0.25)]"
        >
          <i className="ri-loader-4-line animate-spin text-lg" />
          <span>Processing...</span>
        </button>
      ) : !inputAmount || Number(inputAmount) <= 0 ? (
        <button
          disabled
          className="w-full h-14 rounded-2xl text-sm font-bold tracking-wide bg-[#1C202B] text-text-muted border border-border cursor-not-allowed mt-1"
        >
          Enter an amount
        </button>
      ) : Number(inputAmount) > inputBalance ? (
        <button
          disabled
          className="w-full h-14 rounded-2xl text-sm font-bold tracking-wide bg-[#1C202B] text-text-muted border border-border cursor-not-allowed mt-1"
        >
          Insufficient {inputToken.symbol} balance
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={!quote || quoting}
          className="w-full h-14 rounded-2xl text-base font-bold tracking-wide bg-accent text-[#08090C] hover:bg-accent-muted shadow-[0_0_20px_rgba(59,178,115,0.35)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
        >
          <span>Swap</span>
        </button>
      )}

      {/* Token Select Modal */}
      <TokenSelectModal
        isOpen={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        selectedMint={selectorTarget === "input" ? inputToken.mint : outputToken.mint}
        onSelect={(t) => {
          if (selectorTarget === "input") {
            if (t.mint === outputToken.mint) onInvertPair();
            else onSelectInputToken(t);
          } else if (selectorTarget === "output") {
            if (t.mint === inputToken.mint) onInvertPair();
            else onSelectOutputToken(t);
          }
          setInputAmount("");
          setQuote(null);
        }}
      />

      {/* Wallet Modal */}
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
