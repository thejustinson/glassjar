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
}

export function SwapCard({
  initialInputToken,
  initialOutputToken,
  onPairChange,
  className,
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
      className={cn(
        "squircle glass-panel p-5 flex flex-col gap-4 relative",
        className
      )}
    >
      {/* Top Header & Settings Trigger */}
      <div className="flex items-center justify-between pb-1 border-b border-white/[0.07]">
        <div>
          <h2 className="text-base font-bold text-text-primary tracking-wide">Swap Terminal</h2>
          <p className="text-xs text-text-muted">Cookieswap & Cookiebox Aggregator</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="w-8 h-8 rounded-full flex items-center justify-center glass-pill text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors cursor-pointer"
            title="Swap Settings"
          >
            <i className="ri-settings-3-line text-sm" />
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

      {/* ─── YOU PAY CONTAINER ─── */}
      <div
        className={cn(
          "p-4 squircle-md glass-card transition-all duration-150 space-y-2.5",
          activeInput === "pay"
            ? "border-accent ring-1 ring-accent/50 shadow-[0_0_16px_rgba(59,178,115,0.15)]"
            : "hover:border-white/15"
        )}
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-semibold uppercase tracking-wider text-[11px]">You Pay</span>
          <span className="tabular-nums font-mono">
            Balance: {formatNumber(inputBalance, 4)} {inputToken.symbol}
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
            className="w-full bg-transparent text-2xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted"
          />

          {/* Token Selector Pill */}
          <button
            onClick={() => setSelectorTarget("input")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill hover:border-accent/40 text-xs font-bold flex-shrink-0 transition-colors select-none group cursor-pointer"
          >
            <TokenAvatar
              logoUri={inputToken.logoUri}
              symbol={inputToken.symbol}
              size={20}
            />
            <span className="group-hover:text-accent transition-colors">{inputToken.symbol}</span>
            <i className="ri-arrow-down-s-line text-text-muted text-xs" />
          </button>
        </div>

        {/* Value in USD & Quick Percentage Chips */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-text-muted font-mono">
            {inputUsd !== null ? `≈ $${formatNumber(inputUsd, 2)}` : "—"}
          </span>

          <div className="flex items-center gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => handlePercent(p)}
                className="px-2 py-0.5 rounded glass-pill text-[10px] font-bold text-text-muted hover:text-text-primary hover:border-accent/40 transition-colors cursor-pointer"
              >
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── INVERT PAIR BUTTON ─── */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleInvertPair}
          className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-accent hover:border-accent hover:shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all cursor-pointer"
          title="Invert swap tokens"
        >
          <i className="ri-arrow-up-down-line text-base" />
        </button>
      </div>

      {/* ─── YOU RECEIVE CONTAINER ─── */}
      <div
        className={cn(
          "p-4 squircle-md glass-card transition-all duration-150 space-y-2.5",
          activeInput === "receive"
            ? "border-accent ring-1 ring-accent/50 shadow-[0_0_16px_rgba(59,178,115,0.15)]"
            : "hover:border-white/15"
        )}
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            You Receive (Est.)
          </span>
          {quoting && (
            <span className="text-accent flex items-center gap-1 text-[11px]">
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
            className="w-full bg-transparent text-2xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted cursor-default"
          />

          {/* Token Selector Pill */}
          <button
            onClick={() => setSelectorTarget("output")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full glass-pill hover:border-accent/40 text-xs font-bold flex-shrink-0 transition-colors select-none group cursor-pointer"
          >
            <TokenAvatar
              logoUri={outputToken.logoUri}
              symbol={outputToken.symbol}
              size={20}
            />
            <span className="group-hover:text-accent transition-colors">{outputToken.symbol}</span>
            <i className="ri-arrow-down-s-line text-text-muted text-xs" />
          </button>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-text-muted font-mono">
            {outputUsd !== null ? `≈ $${formatNumber(outputUsd, 2)}` : "—"}
          </span>
          <span className="text-xs text-text-muted tabular-nums font-mono">
            Balance: {formatNumber(outputBalance, 4)} {outputToken.symbol}
          </span>
        </div>

        {quoteError && (
          <p className="text-xs text-error font-medium pt-1 flex items-center gap-1">
            <i className="ri-error-warning-line" />
            {quoteError}
          </p>
        )}
      </div>

      {/* ─── QUOTE DETAILS ─── */}
      {quote && (
        <div className="p-3.5 squircle-sm glass-card text-xs space-y-2 text-text-muted">
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
          className={cn(
            "p-3.5 rounded-xl border text-xs space-y-1.5",
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
              <span>View On-Chain on CookieScan</span>
              <i className="ri-external-link-line" />
            </a>
          )}
        </div>
      )}

      {/* ─── DYNAMIC ACTION BUTTON ─── */}
      {!connected ? (
        <button
          onClick={() => setWalletModalOpen(true)}
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all flex items-center justify-center gap-2"
        >
          <i className="ri-wallet-3-line text-sm" />
          <span>Connect Wallet to Swap</span>
        </button>
      ) : txStatus === "simulating" || txStatus === "signing" || txStatus === "confirming" ? (
        <button
          disabled
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider bg-accent/80 text-[#08090C] cursor-wait flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(59,178,115,0.4)]"
        >
          <i className="ri-loader-4-line animate-spin text-sm" />
          <span>{statusMessage}</span>
        </button>
      ) : !inputAmount || Number(inputAmount) <= 0 ? (
        <button
          disabled
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-muted border border-border cursor-not-allowed"
        >
          Enter an Amount
        </button>
      ) : Number(inputAmount) > inputBalance ? (
        <button
          disabled
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-muted border border-border cursor-not-allowed"
        >
          Insufficient {inputToken.symbol} Balance
        </button>
      ) : (
        <button
          onClick={handleSwap}
          disabled={!quote || quoting}
          className="w-full h-12 rounded-xl text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_16px_rgba(59,178,115,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
