"use client";

/**
 * components/swap/SwapCard.tsx
 * Comprehensive Swap Terminal card.
 * Integrates Cookiebox aggregator & CookieScan swap API,
 * provides token selectors, slippage controls, real balances,
 * and complete simulate -> sign -> send -> on-chain confirm lifecycle.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
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
  confirmTransactionPolling,
} from "@/lib/chain";
import {
  formatNumber,
  formatPrice,
  formatPct,
  toBaseUnits,
  fromBaseUnits,
} from "@/lib";
import { cn } from "@/lib/utils";
import { type Token } from "@/lib/das";
import { TokenSelectModal, NATIVE_COOK_TOKEN } from "./TokenSelectModal";
import { WalletModal } from "@/components/wallet/WalletModal";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { recordTransactionDb } from "@/lib/supabase";

interface SwapCardProps {
  initialInputToken?: Token;
  initialOutputToken?: Token;
  onPairChange?: (inputToken: Token, outputToken: Token) => void;
  className?: string;
  compact?: boolean;
}

export function SwapCard({
  initialInputToken,
  initialOutputToken,
  onPairChange,
  className,
  compact = false,
}: SwapCardProps) {
  const { publicKey, connected, signTransaction, sendTransaction } = useWallet();

  // Selected Tokens
  const [inputToken, setInputToken] = useState<Token>(initialInputToken || NATIVE_COOK_TOKEN);
  const [outputToken, setOutputToken] = useState<Token>(
    initialOutputToken || {
      mint: "3Dk9AYeoMZRHg9PmA2LrxrDGyJsNPTVGbRMbNKCsEt23",
      symbol: "TRS",
      name: "Trash",
      decimals: 6,
      logoUri: "https://ipfs.io/ipfs/QmaMg8bUEKsC6qX1fmrNU8EcfYSpA78eTsGoSpYpRfMNcV",
      price: 0.000034,
    }
  );

  useEffect(() => {
    if (initialInputToken) setInputToken(initialInputToken);
  }, [initialInputToken]);

  useEffect(() => {
    if (initialOutputToken) setOutputToken(initialOutputToken);
  }, [initialOutputToken]);

  // Modals
  const [selectorTarget, setSelectorTarget] = useState<"input" | "output" | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeInput, setActiveInput] = useState<"pay" | "receive" | null>(null);

  // Balances
  const [inputBalance, setInputBalance] = useState<number>(0);
  const [outputBalance, setOutputBalance] = useState<number>(0);

  // Swap State
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

  // Auto-dismiss bounce timer for success banner (6 seconds)
  const [isBouncingOut, setIsBouncingOut] = useState(false);
  const [isStatusHovered, setIsStatusHovered] = useState(false);

  useEffect(() => {
    if (txStatus !== "success") {
      setIsBouncingOut(false);
      return;
    }

    if (isStatusHovered) {
      setIsBouncingOut(false);
      return;
    }

    // Begin bounce-out exit at 5.4s, complete removal at 6.0s
    const bounceTimer = setTimeout(() => {
      setIsBouncingOut(true);
    }, 5400);

    const dismissTimer = setTimeout(() => {
      setTxStatus("idle");
      setStatusMessage(null);
      setIsBouncingOut(false);
    }, 6000);

    return () => {
      clearTimeout(bounceTimer);
      clearTimeout(dismissTimer);
    };
  }, [txStatus, isStatusHovered]);


  // Drag & Drop State
  const [isCardDragOver, setIsCardDragOver] = useState(false);
  const [payDragOver, setPayDragOver] = useState(false);
  const [receiveDragOver, setReceiveDragOver] = useState(false);
  const [dropFeedback, setDropFeedback] = useState<string | null>(null);

  function handleDropToken(rawJson: string, target: "pay" | "receive" | "auto") {
    try {
      const token: Token = JSON.parse(rawJson);
      if (!token || !token.mint) return;

      if (target === "pay") {
        if (token.mint.toLowerCase() === outputToken.mint.toLowerCase()) {
          setOutputToken(inputToken);
        }
        setInputToken(token);
        setDropFeedback(`Loaded ${token.symbol} as Pay token`);
      } else if (target === "receive") {
        if (token.mint.toLowerCase() === inputToken.mint.toLowerCase()) {
          setInputToken(outputToken);
        }
        setOutputToken(token);
        setDropFeedback(`Loaded ${token.symbol} as Receive token`);
      } else {
        // Auto: if not same as input, set as output
        if (token.mint.toLowerCase() === inputToken.mint.toLowerCase()) {
          setOutputToken(token);
        } else {
          setOutputToken(token);
        }
        setDropFeedback(`Loaded ${token.symbol} into swap`);
      }
      setTimeout(() => setDropFeedback(null), 2500);
    } catch {}
  }

  // Notify parent on pair changes
  useEffect(() => {
    onPairChange?.(inputToken, outputToken);
  }, [inputToken, outputToken, onPairChange]);

  // Balance Refresh
  const refreshBalances = useCallback(async () => {
    if (!publicKey) {
      setInputBalance(0);
      setOutputBalance(0);
      return;
    }

    try {
      // Input balance
      if (inputToken.mint === NATIVE_COOK_TOKEN.mint) {
        const bal = await getCookBalance(publicKey);
        setInputBalance(bal);
      } else {
        const tBal = await getTokenBalance(publicKey, inputToken.mint);
        setInputBalance(tBal?.uiAmount ?? 0);
      }

      // Output balance
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

  // Invert pair
  function handleInvertPair() {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount("");
    setQuote(null);
  }

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

  // Execute Swap Transaction
  async function handleSwap() {
    if (!publicKey || !quote) return;
    const conn = getConnection();

    try {
      setTxStatus("simulating");
      setStatusMessage("Simulating transaction against Cookie Chain RPC...");

      // 1. Build transaction from quote
      const tx = await buildSwapTransaction(quote, publicKey.toBase58());

      // 2. Preflight Simulation
      const simResult = await simulateSwap(conn, tx, publicKey);
      if (!simResult.ok) {
        throw new Error(simResult.error || "Simulation failed. Please try increasing slippage.");
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

      // 4. Ultra-fast HTTP RPC confirmation
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
        output_amount: quote ? Number(fromBaseUnits(quote.outAmount, outputToken.decimals, 4)) : undefined,
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
    const reserve = isCook ? 0.05 : 0; // gas reserve
    const calc = (inputBalance * p) / 100;
    const finalAmount = Math.max(0, calc - reserve);
    setInputAmount(finalAmount > 0 ? finalAmount.toFixed(4) : "0");
  }

  const estimatedOut = quote ? fromBaseUnits(quote.outAmount, outputToken.decimals, 4) : "";
  const severity = quote ? priceImpactSeverity(quote.priceImpactPct) : "low";

  // Calculate estimated USD values
  const inputUsd =
    inputAmount && inputToken.price ? Number(inputAmount) * inputToken.price : null;
  const outputUsd =
    estimatedOut && outputToken.price ? Number(estimatedOut) * outputToken.price : null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setIsCardDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsCardDragOver(false);
          setPayDragOver(false);
          setReceiveDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsCardDragOver(false);
        setPayDragOver(false);
        setReceiveDragOver(false);
        const raw = e.dataTransfer.getData("application/json");
        if (raw) handleDropToken(raw, "auto");
      }}
      className={cn(
        "squircle glass-panel relative transition-all duration-200",
        compact ? "p-3.5 flex flex-col gap-2.5" : "p-5 flex flex-col gap-4",
        isCardDragOver && "ring-2 ring-accent/60 shadow-[0_0_30px_rgba(59,178,115,0.25)] bg-accent/[0.03]",
        className
      )}
    >
      {/* Top Header & Settings Trigger */}
      <div className={cn("flex items-center justify-between border-b border-white/[0.07]", compact ? "pb-1.5" : "pb-2")}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className={cn("font-bold text-text-primary tracking-wide", compact ? "text-sm" : "text-base")}>
              Swap Terminal
            </h2>
            {isCardDragOver && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/40 animate-pulse">
                Drop token here
              </span>
            )}
          </div>
          <p className={cn("text-text-muted", compact ? "text-[10px]" : "text-xs")}>
            Cookieswap & Cookiebox Aggregator
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={cn(
              "rounded-full flex items-center justify-center glass-pill text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors cursor-pointer",
              compact ? "w-7 h-7" : "w-8 h-8"
            )}
            title="Swap Settings"
          >
            <i className={cn("ri-settings-3-line", compact ? "text-xs" : "text-sm")} />
          </button>

          {/* Settings Popover */}
          <AnimatePresence>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  className="absolute right-0 top-full mt-2 z-50 w-64 p-3.5 squircle-md glass-panel backdrop-blur-2xl shadow-2xl space-y-3"
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
                          "h-7 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer",
                          slippageBps === bps
                            ? "bg-accent text-[#08090C] shadow-sm"
                            : "glass-pill text-text-muted hover:text-text-primary"
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

      {/* Drop Feedback Toast */}
      <AnimatePresence>
        {dropFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent/20 border border-accent/40 text-xs font-bold text-accent shadow-sm"
          >
            <i className="ri-checkbox-circle-fill text-sm" />
            <span>{dropFeedback}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── YOU PAY CONTAINER ─── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setPayDragOver(true);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setPayDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPayDragOver(false);
          setIsCardDragOver(false);
          const raw = e.dataTransfer.getData("application/json");
          if (raw) handleDropToken(raw, "pay");
        }}
        className={cn(
          "squircle-md glass-card transition-all duration-150 relative overflow-hidden",
          compact ? "p-2.5 sm:p-3 space-y-1.5" : "p-4 space-y-2.5",
          payDragOver
            ? "border-accent ring-2 ring-accent bg-accent/15 shadow-[0_0_24px_rgba(59,178,115,0.3)] scale-[1.01]"
            : activeInput === "pay"
            ? "border-accent ring-1 ring-accent/50 shadow-[0_0_16px_rgba(59,178,115,0.15)]"
            : "hover:border-white/15"
        )}
      >
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">You Pay</span>
            {payDragOver && (
              <span className="text-[9px] font-bold text-accent animate-pulse">
                · Drop to set as Pay
              </span>
            )}
          </div>
          <span className="tabular-nums font-mono text-[11px]">
            Bal: {formatNumber(inputBalance, 4)} {inputToken.symbol}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            onFocus={() => setActiveInput("pay")}
            onBlur={() => setActiveInput(null)}
            className={cn(
              "w-full bg-transparent font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted",
              compact ? "text-xl sm:text-2xl" : "text-2xl"
            )}
          />

          {/* Token Selector Pill */}
          <button
            onClick={() => setSelectorTarget("input")}
            className={cn(
              "flex items-center gap-1.5 rounded-full glass-pill hover:border-accent/40 font-bold flex-shrink-0 transition-colors select-none group cursor-pointer",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            )}
          >
            <TokenAvatar
              logoUri={inputToken.logoUri}
              symbol={inputToken.symbol}
              size={compact ? 18 : 20}
            />
            <span className="group-hover:text-accent transition-colors">{inputToken.symbol}</span>
            <i className="ri-arrow-down-s-line text-text-muted text-xs" />
          </button>
        </div>

        {/* Value in USD & Quick Percentage Chips */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-text-muted font-mono">
            {inputUsd !== null ? `≈ $${formatNumber(inputUsd, 2)}` : "—"}
          </span>

          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => handlePercent(p)}
                className="px-1.5 py-0.5 rounded glass-pill text-[9px] font-bold text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors cursor-pointer"
              >
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── INVERT PAIR BUTTON ─── */}
      <div className={cn("flex justify-center relative z-10", compact ? "-my-1.5" : "-my-2")}>
        <button
          onClick={handleInvertPair}
          className={cn(
            "rounded-full glass-pill flex items-center justify-center text-accent hover:border-accent hover:shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all cursor-pointer",
            compact ? "w-7 h-7 text-xs" : "w-9 h-9 text-base"
          )}
          title="Invert swap tokens"
        >
          <i className="ri-arrow-up-down-line" />
        </button>
      </div>

      {/* ─── YOU RECEIVE CONTAINER ─── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
          setReceiveDragOver(true);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          setReceiveDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setReceiveDragOver(false);
          setIsCardDragOver(false);
          const raw = e.dataTransfer.getData("application/json");
          if (raw) handleDropToken(raw, "receive");
        }}
        className={cn(
          "squircle-md glass-card transition-all duration-150 relative overflow-hidden",
          compact ? "p-2.5 sm:p-3 space-y-1.5" : "p-4 space-y-2.5",
          receiveDragOver
            ? "border-accent ring-2 ring-accent bg-accent/15 shadow-[0_0_24px_rgba(59,178,115,0.3)] scale-[1.01]"
            : activeInput === "receive"
            ? "border-accent ring-1 ring-accent/50 shadow-[0_0_16px_rgba(59,178,115,0.15)]"
            : "hover:border-white/15"
        )}
      >
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold uppercase tracking-wider text-[10px]">
              You Receive (Est.)
            </span>
            {receiveDragOver && (
              <span className="text-[9px] font-bold text-accent animate-pulse">
                · Drop to set as Receive
              </span>
            )}
          </div>
          {quoting && (
            <span className="text-accent flex items-center gap-1 text-[10px]">
              <i className="ri-loader-4-line animate-spin" />
              Routing…
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            readOnly
            placeholder="0.00"
            value={quoting ? "..." : estimatedOut || ""}
            onFocus={() => setActiveInput("receive")}
            onBlur={() => setActiveInput(null)}
            onClick={() => setActiveInput("receive")}
            className={cn(
              "w-full bg-transparent font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted cursor-default",
              compact ? "text-xl sm:text-2xl" : "text-2xl"
            )}
          />

          {/* Token Selector Pill */}
          <button
            onClick={() => setSelectorTarget("output")}
            className={cn(
              "flex items-center gap-1.5 rounded-full glass-pill hover:border-accent/40 font-bold flex-shrink-0 transition-colors select-none group cursor-pointer",
              compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
            )}
          >
            <TokenAvatar
              logoUri={outputToken.logoUri}
              symbol={outputToken.symbol}
              size={compact ? 18 : 20}
            />
            <span className="group-hover:text-accent transition-colors">{outputToken.symbol}</span>
            <i className="ri-arrow-down-s-line text-text-muted text-xs" />
          </button>
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] text-text-muted font-mono">
            {outputUsd !== null ? `≈ $${formatNumber(outputUsd, 2)}` : "—"}
          </span>
          <span className="text-[11px] text-text-muted tabular-nums font-mono">
            Bal: {formatNumber(outputBalance, 4)} {outputToken.symbol}
          </span>
        </div>

        {quoteError && (
          <p className="text-xs text-error font-medium pt-0.5 flex items-center gap-1">
            <i className="ri-error-warning-line" />
            {quoteError}
          </p>
        )}
      </div>

      {/* ─── QUOTE DETAILS ─── */}
      {quote && (
        <div className={cn("squircle-sm glass-card text-xs text-text-muted", compact ? "p-2.5 space-y-1" : "p-3.5 space-y-2")}>
          <div className="flex items-center justify-between">
            <span>Price Impact</span>
            <span
              className={cn(
                "font-bold font-mono",
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
            <span>Slippage Tolerance</span>
            <span className="font-mono text-text-primary font-semibold">
              {(slippageBps / 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span>Aggregator</span>
            <span className="text-text-secondary font-medium uppercase tracking-wider text-[10px]">
              {quote._source === "cookiebox" ? "Cookiebox DAMM v2" : "CookieScan Swap Router"}
            </span>
          </div>
        </div>
      )}

      {/* ─── TRANSACTION STATUS BANNER ─── */}
      {txStatus !== "idle" && (
        <div
          onMouseEnter={() => setIsStatusHovered(true)}
          onMouseLeave={() => setIsStatusHovered(false)}
          className={cn(
            "p-3 rounded-xl border text-xs space-y-1.5 transition-all",
            !isBouncingOut && "animate-in fade-in slide-in-from-top-1",
            isBouncingOut && "animate-bounce-out pointer-events-none",
            txStatus === "success" && "bg-success/10 border-success/30 text-success",
            txStatus === "error" && "bg-error/10 border-error/30 text-error",
            (txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming") &&
              "bg-accent/10 border-accent/30 text-accent"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              {txStatus === "success" && <i className="ri-checkbox-circle-line text-base shrink-0 mt-0.5" />}
              {txStatus === "error" && <i className="ri-error-warning-line text-base shrink-0 mt-0.5" />}
              {(txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming") && (
                <i className="ri-loader-4-line animate-spin text-base shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5 min-w-0">
                <p className="font-semibold text-xs leading-tight">
                  {txStatus === "simulating" && "Simulating Transaction"}
                  {txStatus === "signing" && "Awaiting Signature"}
                  {txStatus === "confirming" && "Confirming On-Chain"}
                  {txStatus === "success" && "Swap Completed"}
                  {txStatus === "error" && "Swap Failed"}
                </p>
                {statusMessage && (
                  <p className="text-[11px] text-text-secondary leading-relaxed break-words font-normal">
                    {statusMessage}
                  </p>
                )}
              </div>
            </div>

            {(txStatus === "success" || txStatus === "error") && (
              <button
                type="button"
                onClick={() => {
                  setIsBouncingOut(true);
                  setTimeout(() => {
                    setTxStatus("idle");
                    setStatusMessage(null);
                    setIsBouncingOut(false);
                  }, 500);
                }}
                className="text-text-muted hover:text-text-primary p-0.5 shrink-0 transition-colors"
                title="Dismiss"
              >
                <i className="ri-close-line text-sm" />
              </button>
            )}
          </div>

          {txSignature && (
            <a
              href={explorerTxUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline flex items-center gap-1 hover:opacity-80 pt-0.5 text-accent font-medium inline-flex"
            >
              <span>View On-Chain on CookieScan</span>
              <i className="ri-external-link-line text-xs" />
            </a>
          )}
        </div>
      )}

      {/* ─── DYNAMIC ACTION BUTTON ─── */}
      {!connected ? (
        <button
          onClick={() => setWalletModalOpen(true)}
          className={cn(
            "w-full rounded-xl text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer",
            compact ? "h-10 sm:h-11" : "h-12"
          )}
        >
          <i className="ri-wallet-3-line text-sm" />
          <span>Connect Wallet to Swap</span>
        </button>
      ) : txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming" ? (
        <button
          disabled
          className={cn(
            "w-full rounded-xl text-xs font-bold uppercase tracking-wider bg-accent/80 text-[#08090C] cursor-wait flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(59,178,115,0.4)]",
            compact ? "h-10 sm:h-11" : "h-12"
          )}
        >
          <i className="ri-loader-4-line animate-spin text-sm" />
          <span>
            {txStatus === "simulating"
              ? "Simulating Swap…"
              : txStatus === "signing"
              ? "Approve in Wallet…"
              : "Confirming On-Chain…"}
          </span>
        </button>
      ) : !inputAmount || Number(inputAmount) <= 0 ? (
        <button
          disabled
          className={cn(
            "w-full rounded-xl text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-muted border border-border cursor-not-allowed",
            compact ? "h-10 sm:h-11" : "h-12"
          )}
        >
          Enter an Amount
        </button>
      ) : Number(inputAmount) > inputBalance ? (
        <button
          disabled
          className={cn(
            "w-full rounded-xl text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-muted border border-border cursor-not-allowed",
            compact ? "h-10 sm:h-11" : "h-12"
          )}
        >
          Insufficient {inputToken.symbol} Balance
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={!quote || quoting}
          className={cn(
            "w-full rounded-xl text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer",
            compact ? "h-10 sm:h-11" : "h-12"
          )}
        >
          <i className="ri-swap-line text-base" />
          <span>Swap Tokens</span>
        </button>
      )}

      {/* Token Select Modal */}
      <TokenSelectModal
        isOpen={selectorTarget !== null}
        onClose={() => setSelectorTarget(null)}
        selectedMint={selectorTarget === "input" ? inputToken.mint : outputToken.mint}
        onSelect={(t) => {
          if (selectorTarget === "input") {
            if (t.mint === outputToken.mint) handleInvertPair();
            else setInputToken(t);
          } else if (selectorTarget === "output") {
            if (t.mint === inputToken.mint) handleInvertPair();
            else setOutputToken(t);
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
