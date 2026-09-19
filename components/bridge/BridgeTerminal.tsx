"use client";

/**
 * components/bridge/BridgeTerminal.tsx
 * High-density, streamlined Bridge Terminal for Cookie Chain ↔ Solana Mainnet.
 * Features:
 * - Direct native SOL & Token-2022 COOK selection on Solana.
 * - 2-step guided execution (SOL → COOK on Solana, then Hyperlane Warp Route to Cookie Chain).
 * - Automatic 0.008 SOL gas buffer protection.
 * - Clean, non-wordy compact layout with collapsible recipient and clear progress tracking.
 * - Vibrant #FBFF6C secondary accent.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  calculateBridgeAmounts,
  getDestinationCollateral,
  getSolanaCookBalance,
  getSolanaWalletBalances,
  buildBridgeTransaction,
  broadcastBridgeTransaction,
  checkBridgeDelivery,
  fetchMessageIdFromTx,
  getHyperlaneMessageUrl,
  fetchSolanaSwapQuote,
  buildSolanaSwapTransaction,
  getSafeMaxSolAmount,
  type SolanaSwapQuoteResult,
  OFFICIAL_BRIDGE_URL,
  COOKIE_WARP_PROGRAM_ID,
  SOLANA_WARP_PROGRAM_ID,
  SOLANA_WARP_MINT,
  COOKIE_NATIVE_DECIMALS,
  SOLANA_WARP_DECIMALS,
  type BridgeDirection,
  type BridgeQuote,
} from "@/lib/bridge";
import { getCookBalance, explorerTxUrl } from "@/lib/chain";
import { formatNumber, truncateAddress } from "@/lib";
import { cn } from "@/lib/utils";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { WalletModal } from "@/components/wallet/WalletModal";
import { recordTransactionDb } from "@/lib/supabase";

export function BridgeTerminal() {
  const router = useRouter();
  const { publicKey, connected, signTransaction } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Direction: "solana-to-cookie" or "cookie-to-solana"
  const [direction, setBridgeDirection] = useState<BridgeDirection>("solana-to-cookie");
  const isCookieToSolana = direction === "cookie-to-solana";

  // Source Asset on Solana: "SOL" or "COOK"
  const [sourceAsset, setSourceAsset] = useState<"SOL" | "COOK">("SOL");

  // Balances
  const [cookieBalance, setCookieBalance] = useState<number>(0);
  const [solanaBalance, setSolanaBalance] = useState<number>(0);
  const [solNativeBalance, setSolNativeBalance] = useState<number>(0);
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);

  // Form State
  const [amount, setAmount] = useState<string>("");
  const [customRecipient, setCustomRecipient] = useState<string>("");
  const [showRecipientInput, setShowRecipientInput] = useState<boolean>(false);

  // Solana Swap Quote State (SOL -> COOK)
  const [solQuote, setSolQuote] = useState<SolanaSwapQuoteResult | null>(null);
  const [loadingSolQuote, setLoadingSolQuote] = useState<boolean>(false);
  const [solQuoteError, setSolQuoteError] = useState<string | null>(null);
  const quoteDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 2-Step Execution State
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [solSwapTxHash, setSolSwapTxHash] = useState<string | null>(null);
  const [receivedCook, setReceivedCook] = useState<number | null>(null);

  // Collateral Preflight
  const [collateral, setCollateral] = useState<{ available: number; maxTransfer: number }>({
    available: 75000000,
    maxTransfer: 500000,
  });

  // Transfer Lifecycle
  const [transferStatus, setTransferStatus] = useState<
    "idle" | "preparing" | "signing" | "broadcasting" | "source_confirming" | "awaiting_delivery" | "delivered" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [destTxHash, setDestTxHash] = useState<string | null>(null);
  const [uniqueMessageAccount, setUniqueMessageAccount] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isSolMode = !isCookieToSolana && sourceAsset === "SOL";

  const effectiveSourceBalance = isCookieToSolana
    ? cookieBalance
    : sourceAsset === "SOL"
    ? solNativeBalance
    : solanaBalance;

  const effectiveDestBalance = isCookieToSolana ? solanaBalance : cookieBalance;
  const sourceChainName = isCookieToSolana ? "Cookie Chain" : "Solana";
  const destChainName = isCookieToSolana ? "Solana" : "Cookie Chain";

  // Refresh balances & collateral
  const refreshData = useCallback(async () => {
    if (publicKey) {
      setLoadingBalances(true);
      try {
        const [cBal, sBal] = await Promise.allSettled([
          getCookBalance(publicKey),
          getSolanaWalletBalances(publicKey),
        ]);
        if (cBal.status === "fulfilled") setCookieBalance(cBal.value);
        if (sBal.status === "fulfilled") {
          setSolanaBalance(sBal.value.cook);
          setSolNativeBalance(sBal.value.sol);
        }
      } catch {
        // ignore
      } finally {
        setLoadingBalances(false);
      }
    }

    try {
      const col = await getDestinationCollateral(direction);
      setCollateral(col);
    } catch {
      // ignore
    }
  }, [publicKey, direction]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Debounced quote fetcher for SOL
  useEffect(() => {
    if (!isSolMode || !amount || Number(amount) <= 0) {
      setSolQuote(null);
      setSolQuoteError(null);
      setLoadingSolQuote(false);
      return;
    }

    if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
    setLoadingSolQuote(true);
    setSolQuoteError(null);

    quoteDebounceRef.current = setTimeout(async () => {
      try {
        const q = await fetchSolanaSwapQuote(amount, 100);
        setSolQuote(q);
      } catch (err: any) {
        setSolQuoteError(err?.message || "Quote unavailable");
        setSolQuote(null);
      } finally {
        setLoadingSolQuote(false);
      }
    }, 350);

    return () => {
      if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
    };
  }, [amount, isSolMode]);

  // Flip Direction
  function handleFlipDirection() {
    setBridgeDirection((d) =>
      d === "cookie-to-solana" ? "solana-to-cookie" : "cookie-to-solana"
    );
    setAmount("");
    setSolQuote(null);
    setTransferStatus("idle");
    setStatusMessage(null);
  }

  // Quick percentage selection
  function handlePercent(p: number) {
    if (effectiveSourceBalance <= 0) return;
    if (isSolMode) {
      if (p === 100) {
        const safeMax = getSafeMaxSolAmount(solNativeBalance, 0.008);
        setAmount(safeMax > 0 ? safeMax.toString() : "0");
      } else {
        const calc = (solNativeBalance * p) / 100;
        setAmount(calc > 0 ? calc.toFixed(4) : "0");
      }
    } else {
      const calc = (effectiveSourceBalance * p) / 100;
      setAmount(calc > 0 ? (p === 100 ? calc.toString() : calc.toFixed(4)) : "0");
    }
  }

  // Calculate quote for COOK 1:1 bridge
  const standardQuote: BridgeQuote | null = !isSolMode
    ? calculateBridgeAmounts(amount, direction, collateral.available)
    : null;

  const expectedDestCook = isSolMode
    ? solQuote
      ? solQuote.outputCookAmount
      : 0
    : standardQuote
    ? standardQuote.destAmount
    : 0;

  const exceedsCollateral =
    expectedDestCook > 0 && expectedDestCook > collateral.available;

  const isSolGasInsufficient =
    isSolMode &&
    connected &&
    (solNativeBalance < 0.008 || Number(amount) > solNativeBalance - 0.008);

  const effectiveRecipient = customRecipient.trim() || (publicKey ? publicKey.toBase58() : "");

  // ─── EXECUTION HANDLER ───────────────────────────────────────────────────────

  async function handleBridge() {
    if (!connected || !publicKey) {
      setWalletModalOpen(true);
      return;
    }

    if (!signTransaction) {
      setTransferStatus("error");
      setStatusMessage("Your wallet does not support signing. Connect Nightly or Phantom.");
      return;
    }

    if (exceedsCollateral) return;

    const destRecipient = effectiveRecipient;
    const initialDestBal = isCookieToSolana ? solanaBalance : cookieBalance;

    setTxHash(null);
    setDestTxHash(null);
    setSolSwapTxHash(null);
    setUniqueMessageAccount(null);

    // ── CASE A: 2-Step SOL Bridging ──
    if (isSolMode) {
      if (!solQuote || !solQuote.rawQuote) {
        setStatusMessage("Awaiting swap quote...");
        return;
      }

      if (solNativeBalance < 0.008 + Number(amount)) {
        setTransferStatus("error");
        setStatusMessage("Insufficient SOL. Keep at least 0.008 SOL for network gas.");
        return;
      }

      try {
        // Step 1: Swap SOL -> COOK on Solana
        setCurrentStep(1);
        setTransferStatus("preparing");
        setStatusMessage("Building Solana swap transaction...");

        const swapTx = await buildSolanaSwapTransaction(
          solQuote.rawQuote,
          publicKey.toBase58()
        );

        setTransferStatus("signing");
        setStatusMessage("Approve Step 1 in wallet: Swap SOL to COOK on Solana.");

        let signedSwapTx;
        try {
          signedSwapTx = await signTransaction(swapTx);
        } catch (err: any) {
          if (
            err?.message?.includes("User rejected") ||
            err?.message?.includes("cancelled") ||
            err?.name === "WalletSignTransactionError"
          ) {
            setTransferStatus("idle");
            setStatusMessage("Signature cancelled.");
            return;
          }
          throw err;
        }

        setTransferStatus("broadcasting");
        setStatusMessage("Broadcasting swap to Solana...");
        const swapHash = await broadcastBridgeTransaction(signedSwapTx, "solana");
        setSolSwapTxHash(swapHash);

        recordTransactionDb({
          signature: swapHash,
          wallet_address: publicKey.toBase58(),
          tx_type: "swap",
          source_chain: "solana",
          dest_chain: "solana",
          input_symbol: "SOL",
          input_amount: Number(amount),
          output_symbol: "COOK",
          output_amount: solQuote.outputCookAmount,
          status: "confirmed",
        });

        setTransferStatus("source_confirming");
        setStatusMessage("Swap submitted. Confirming on Solana (~3s)...");
        await new Promise((r) => setTimeout(r, 3500));

        await refreshData();
        const cookAmountToBridge = solQuote.outputCookAmount;
        setReceivedCook(cookAmountToBridge);

        // Step 2: Bridge COOK to Cookie Chain
        setCurrentStep(2);
        setTransferStatus("preparing");
        setStatusMessage(`Preparing bridge for ${formatNumber(cookAmountToBridge, 0)} COOK...`);

        const builtWarp = await buildBridgeTransaction({
          direction: "solana-to-cookie",
          fromAddress: publicKey.toBase58(),
          toAddress: destRecipient,
          amount: cookAmountToBridge.toString(),
        });
        setUniqueMessageAccount(builtWarp.uniqueMessageAccount);

        setTransferStatus("signing");
        setStatusMessage(`Approve Step 2 in wallet: Bridge COOK to Cookie Chain.`);

        let signedWarpTx;
        try {
          signedWarpTx = await signTransaction(builtWarp.transaction);
        } catch (err: any) {
          if (
            err?.message?.includes("User rejected") ||
            err?.message?.includes("cancelled") ||
            err?.name === "WalletSignTransactionError"
          ) {
            setTransferStatus("error");
            setStatusMessage("Bridge signature cancelled. Switch token to COOK to finish bridging.");
            setSourceAsset("COOK");
            setAmount(cookAmountToBridge.toString());
            return;
          }
          throw err;
        }

        setTransferStatus("broadcasting");
        setStatusMessage("Dispatching bridge transfer...");
        const warpHash = await broadcastBridgeTransaction(signedWarpTx, "solana");
        setTxHash(warpHash);

        recordTransactionDb({
          signature: warpHash,
          wallet_address: publicKey.toBase58(),
          tx_type: "bridge",
          source_chain: "solana",
          dest_chain: "cookie",
          input_symbol: "SOL",
          input_amount: Number(amount),
          output_symbol: "COOK",
          output_amount: cookAmountToBridge,
          status: "confirmed",
          message_id: builtWarp.uniqueMessageAccount || undefined,
        });

        setTransferStatus("source_confirming");
        setStatusMessage("Bridge dispatched! Confirming on Solana...");
        await new Promise((r) => setTimeout(r, 4000));

        startDeliveryPolling(
          warpHash,
          "solana",
          "cookie",
          cookAmountToBridge,
          initialDestBal,
          builtWarp.uniqueMessageAccount
        );
      } catch (err: any) {
        setTransferStatus("error");
        handleTxError(err);
      }
      return;
    }

    // ── CASE B: 1-Step COOK Bridging ──
    try {
      setTransferStatus("preparing");
      setStatusMessage("Preparing bridge transaction...");

      const sourceChain = isCookieToSolana ? "cookie" : "solana";
      const destChain = isCookieToSolana ? "solana" : "cookie";
      const transferAmountNum = Number(amount.trim());
      setReceivedCook(transferAmountNum);

      const built = await buildBridgeTransaction({
        direction,
        fromAddress: publicKey.toBase58(),
        toAddress: destRecipient,
        amount: amount.trim(),
      });
      setUniqueMessageAccount(built.uniqueMessageAccount);

      setTransferStatus("signing");
      setStatusMessage(
        isCookieToSolana
          ? "Approve in wallet on Cookie Chain."
          : "Approve in wallet on Solana."
      );

      let signedTx;
      try {
        signedTx = await signTransaction(built.transaction);
      } catch (err: any) {
        if (
          err?.message?.includes("User rejected") ||
          err?.message?.includes("cancelled") ||
          err?.name === "WalletSignTransactionError"
        ) {
          setTransferStatus("idle");
          setStatusMessage("Signature cancelled.");
          return;
        }
        throw err;
      }

      setTransferStatus("broadcasting");
      setStatusMessage(`Broadcasting to ${sourceChainName}...`);

      const hash = await broadcastBridgeTransaction(signedTx, sourceChain);
      setTxHash(hash);

      recordTransactionDb({
        signature: hash,
        wallet_address: publicKey.toBase58(),
        tx_type: "bridge",
        source_chain: sourceChain,
        dest_chain: destChain,
        input_symbol: "COOK",
        input_amount: transferAmountNum,
        output_symbol: "COOK",
        output_amount: transferAmountNum,
        status: "confirmed",
        message_id: built.uniqueMessageAccount || undefined,
      });

      setTransferStatus("source_confirming");
      setStatusMessage(`Transaction confirmed on ${sourceChainName}...`);
      await new Promise((r) => setTimeout(r, 4000));

      startDeliveryPolling(
        hash,
        sourceChain,
        destChain,
        transferAmountNum,
        initialDestBal,
        built.uniqueMessageAccount
      );
    } catch (err: any) {
      setTransferStatus("error");
      handleTxError(err);
    }
  }

  function startDeliveryPolling(
    hash: string,
    sourceChain: "cookie" | "solana",
    destChain: "cookie" | "solana",
    transferAmountNum: number,
    initialDestBal: number,
    initialMsgId?: string
  ) {
    setTransferStatus("awaiting_delivery");
    setStatusMessage("Source confirmed. Hyperlane relayer delivering to destination (~1–3 min)...");

    let resolvedMsgId: string | null = initialMsgId || null;
    const startTime = Date.now();

    const pollTimer = setInterval(async () => {
      try {
        const currentDest =
          destChain === "solana"
            ? await getSolanaCookBalance(publicKey!)
            : await getCookBalance(publicKey!);

        if (
          currentDest > initialDestBal + 0.0001 ||
          (transferAmountNum > 0 && currentDest >= initialDestBal + transferAmountNum * 0.9)
        ) {
          clearInterval(pollTimer);
          setTransferStatus("delivered");
          setStatusMessage("Bridge complete! Funds received on destination chain.");
          recordTransactionDb({
            signature: hash,
            wallet_address: publicKey!.toBase58(),
            tx_type: "bridge",
            source_chain: sourceChain,
            dest_chain: destChain,
            input_symbol: isSolMode ? "SOL" : "COOK",
            input_amount: Number(amount),
            output_symbol: "COOK",
            output_amount: transferAmountNum,
            status: "delivered",
            message_id: resolvedMsgId || undefined,
          });
          refreshData();
          return;
        }

        if (!resolvedMsgId) {
          resolvedMsgId = await fetchMessageIdFromTx(hash, sourceChain);
          if (resolvedMsgId) setUniqueMessageAccount(resolvedMsgId);
        }

        const targetId = resolvedMsgId || initialMsgId;
        if (targetId) {
          const check = await checkBridgeDelivery(targetId, destChain);
          if (check.delivered) {
            clearInterval(pollTimer);
            setTransferStatus("delivered");
            setDestTxHash(check.deliveryTx || null);
            setStatusMessage("Bridge complete! Funds delivered to destination wallet.");
            refreshData();
            return;
          }
        }
      } catch {
        // polling error ignored
      }

      refreshData();

      if (Date.now() - startTime > 180000) {
        clearInterval(pollTimer);
        setTransferStatus("delivered");
        setStatusMessage("Transfer dispatched. Final relayer confirmation taking slightly longer.");
        refreshData();
      }
    }, 2500);
  }

  function handleTxError(err: any) {
    const msg = err?.message || "";
    if (
      msg.includes("insufficient lamports") ||
      msg.includes("custom program error: 0x1") ||
      msg.includes("Custom\":1")
    ) {
      setStatusMessage("Insufficient SOL for gas. Need ~0.008 SOL for network fee and message account.");
    } else {
      setStatusMessage(msg || "Bridge transfer failed.");
    }
  }

  return (
    <div className="w-full max-w-[480px] squircle-lg bg-[#0E1015] border border-border p-4 sm:p-5 flex flex-col gap-3 relative select-none">
      {/* ─── TOP BAR ─── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black text-text-primary tracking-wide">Bridge</h2>
          <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-bold">
            Hyperlane 1:1
          </span>
        </div>

        {/* Route Direction Switcher Badge */}
        <button
          onClick={handleFlipDirection}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141720] border border-border hover:border-secondary/50 transition-all text-xs font-semibold cursor-pointer group"
          title="Switch direction"
        >
          <span className="text-text-secondary group-hover:text-text-primary text-[11px]">
            {sourceChainName}
          </span>
          <i className="ri-arrow-right-line text-secondary text-xs group-hover:translate-x-0.5 transition-transform" />
          <span className="text-text-secondary group-hover:text-text-primary text-[11px]">
            {destChainName}
          </span>
        </button>
      </div>

      {/* ─── FROM CONTAINER ─── */}
      <div className="p-3.5 squircle-md bg-[#141720] border border-border space-y-2 focus-within:border-secondary/70 transition-colors">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span className="font-bold text-text-secondary uppercase tracking-wider">
            From {sourceChainName}
          </span>
          <div className="flex items-center gap-1.5 font-mono">
            <span>Bal: {loadingBalances ? "..." : formatNumber(effectiveSourceBalance, 3)}</span>
            <button
              onClick={refreshData}
              className="hover:text-secondary p-0.5 cursor-pointer"
              title="Refresh balance"
            >
              <i className={cn("ri-refresh-line text-[11px]", loadingBalances && "animate-spin text-secondary")} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none placeholder:text-text-muted/50"
          />

          {/* Token Selector / Toggle */}
          {!isCookieToSolana ? (
            <div className="flex items-center p-0.5 rounded-full bg-[#1A1E29] border border-border flex-shrink-0">
              <button
                onClick={() => {
                  setSourceAsset("SOL");
                  setAmount("");
                  setSolQuote(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                  sourceAsset === "SOL"
                    ? "bg-secondary text-black"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                <img src="/solana-logo.png" alt="SOL" className="w-3.5 h-3.5 rounded-full bg-black" />
                <span>SOL</span>
              </button>
              <button
                onClick={() => {
                  setSourceAsset("COOK");
                  setAmount("");
                  setSolQuote(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer",
                  sourceAsset === "COOK"
                    ? "bg-secondary text-black"
                    : "text-text-muted hover:text-text-primary"
                )}
              >
                <TokenAvatar symbol="COOK" size={14} />
                <span>COOK</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1E29] border border-border text-xs font-bold flex-shrink-0">
              <TokenAvatar symbol="COOK" size={18} />
              <span className="text-text-primary font-bold">COOK</span>
            </div>
          )}
        </div>

        {/* Quick Percentages & Live Conversion */}
        <div className="flex items-center justify-between pt-0.5 text-[11px] font-mono">
          <div className="text-text-muted truncate max-w-[200px]">
            {isSolMode ? (
              loadingSolQuote ? (
                <span className="text-secondary animate-pulse">Calculating swap route...</span>
              ) : solQuote ? (
                <span className="text-text-secondary">
                  ≈ {formatNumber(solQuote.outputCookAmount, 0)} COOK on Solana
                </span>
              ) : (
                <span>Jupiter / PumpSwap AMM</span>
              )
            ) : (
              <span>1 COOK = 1 COOK</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => handlePercent(p)}
                className="px-2 py-0.5 rounded-full bg-bg-card border border-border/80 text-[10px] font-bold text-text-muted hover:text-text-primary hover:border-secondary/50 transition-colors cursor-pointer"
              >
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FLIP BUTTON DIVIDER ─── */}
      <div className="relative flex items-center justify-center -my-1 z-10">
        <button
          onClick={handleFlipDirection}
          className="w-7 h-7 rounded-full bg-[#141720] border border-border hover:border-secondary flex items-center justify-center text-secondary hover:rotate-180 transition-all cursor-pointer"
          title="Invert route"
        >
          <i className="ri-arrow-up-down-line text-xs" />
        </button>
      </div>

      {/* ─── TO CONTAINER ─── */}
      <div className="p-3.5 squircle-md bg-[#141720] border border-border space-y-2">
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span className="font-bold text-text-secondary uppercase tracking-wider">
            To {destChainName}
          </span>
          <span className="font-mono">
            Bal: {loadingBalances ? "..." : formatNumber(effectiveDestBalance, 3)} COOK
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            readOnly
            placeholder="0.0"
            value={
              isSolMode
                ? loadingSolQuote
                  ? "..."
                  : solQuote
                  ? formatNumber(solQuote.outputCookAmount, 2)
                  : "0.0"
                : standardQuote
                ? standardQuote.destAmount.toString()
                : amount || "0.0"
            }
            className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none cursor-default"
          />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1A1E29] border border-border text-xs font-bold flex-shrink-0">
            <TokenAvatar symbol="COOK" size={18} />
            <span className="text-text-primary font-bold">COOK</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-0.5 text-[11px] font-mono text-text-muted">
          <span>Est. Delivery: ~2 min</span>
          <span>Interchain Fee: ~0.01 COOK</span>
        </div>
      </div>

      {/* ─── COMPACT RECIPIENT ACCORDION ─── */}
      <div className="px-3 py-2 squircle-sm bg-[#10121A] border border-border text-xs flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-muted">Recipient:</span>
          <div className="flex items-center gap-1.5 font-mono">
            <span className="text-text-secondary">
              {customRecipient
                ? truncateAddress(customRecipient, 4)
                : publicKey
                ? `${truncateAddress(publicKey.toBase58(), 4)} (Your Wallet)`
                : "Not connected"}
            </span>
            <button
              onClick={() => setShowRecipientInput(!showRecipientInput)}
              className="text-secondary hover:underline text-[10px] font-bold cursor-pointer"
            >
              {showRecipientInput ? "Done" : "Edit"}
            </button>
          </div>
        </div>

        {showRecipientInput && (
          <input
            type="text"
            placeholder={publicKey ? publicKey.toBase58() : "Enter recipient address..."}
            value={customRecipient}
            onChange={(e) => setCustomRecipient(e.target.value)}
            className="w-full mt-1 bg-bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-muted/50 focus:border-secondary outline-none"
          />
        )}
      </div>

      {/* ─── 2-STEP STEPPER (SOL mode active) ─── */}
      {isSolMode && (
        <div className="px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px]",
                solSwapTxHash
                  ? "bg-accent text-black"
                  : currentStep === 1 && transferStatus !== "idle"
                  ? "bg-secondary text-black animate-pulse"
                  : "bg-bg-card text-text-muted border border-border"
              )}
            >
              {solSwapTxHash ? "✓" : "1"}
            </span>
            <span className={solSwapTxHash ? "text-accent font-semibold" : "text-text-primary"}>
              Swap SOL → COOK
            </span>
          </div>

          <i className="ri-arrow-right-s-line text-text-muted" />

          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px]",
                transferStatus === "delivered"
                  ? "bg-accent text-black"
                  : currentStep === 2 && transferStatus !== "idle"
                  ? "bg-secondary text-black animate-pulse"
                  : "bg-bg-card text-text-muted border border-border"
              )}
            >
              {transferStatus === "delivered" ? "✓" : "2"}
            </span>
            <span
              className={
                transferStatus === "delivered"
                  ? "text-accent font-semibold"
                  : currentStep === 2
                  ? "text-secondary font-semibold"
                  : "text-text-muted"
              }
            >
              Bridge COOK
            </span>
          </div>
        </div>
      )}

      {/* ─── MICRO ALERTS (Gas / Collateral) ─── */}
      {isSolGasInsufficient && (
        <div className="px-3 py-2 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-2">
          <i className="ri-error-warning-line shrink-0" />
          <span>Keep at least 0.008 SOL for network gas and message account.</span>
        </div>
      )}

      {exceedsCollateral && (
        <div className="px-3 py-2 rounded-xl bg-error/10 border border-error/30 text-error text-xs flex items-center gap-2">
          <i className="ri-error-warning-line shrink-0" />
          <span>Amount exceeds destination pool ({formatNumber(collateral.available, 0)} COOK).</span>
        </div>
      )}

      {/* ─── STATUS BANNER ─── */}
      {/* ─── STATUS BANNER (In-progress or Error) ─── */}
      {transferStatus !== "idle" && transferStatus !== "delivered" && (
        <div
          className={cn(
            "p-3 rounded-xl border text-xs space-y-1.5",
            (transferStatus === "preparing" ||
              transferStatus === "signing" ||
              transferStatus === "broadcasting" ||
              transferStatus === "source_confirming" ||
              transferStatus === "awaiting_delivery") &&
              "bg-warning/10 border-warning/30 text-warning",
            transferStatus === "error" && "bg-error/10 border-error/30 text-error"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(transferStatus === "preparing" ||
                transferStatus === "signing" ||
                transferStatus === "broadcasting" ||
                transferStatus === "source_confirming") && (
                <i className="ri-loader-4-line animate-spin text-sm" />
              )}
              {transferStatus === "awaiting_delivery" && (
                <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              )}
              {transferStatus === "error" && (
                <i className="ri-error-warning-line text-sm text-error" />
              )}
              <span className="font-semibold text-text-primary text-xs">{statusMessage}</span>
            </div>

            {transferStatus === "error" && (
              <button
                onClick={() => {
                  setTransferStatus("idle");
                  setStatusMessage(null);
                }}
                className="text-text-muted hover:text-text-primary p-0.5 cursor-pointer"
              >
                <i className="ri-close-line" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono border-t border-border/40 pt-1">
            {solSwapTxHash && (
              <a
                href={`https://solscan.io/tx/${solSwapTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-text-secondary hover:text-text-primary flex items-center gap-0.5"
              >
                <span>Swap Tx</span>
                <i className="ri-external-link-line" />
              </a>
            )}
            {txHash && (
              <a
                href={isCookieToSolana ? `https://cookiescan.io/tx/${txHash}` : `https://solscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-text-secondary hover:text-text-primary flex items-center gap-0.5"
              >
                <span>Bridge Tx</span>
                <i className="ri-external-link-line" />
              </a>
            )}
            {uniqueMessageAccount && (
              <a
                href={
                  uniqueMessageAccount.startsWith("0x")
                    ? `https://explorer.hyperlane.xyz/message/${uniqueMessageAccount}`
                    : "https://explorer.hyperlane.xyz"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-text-muted hover:text-text-primary flex items-center gap-0.5"
              >
                <span>Hyperlane</span>
                <i className="ri-external-link-line" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── GUIDED POST-BRIDGE COMPLETION CARD (Direction-Aware) ─── */}
      {transferStatus === "delivered" && (
        <div className="p-4 squircle-md bg-[#10141E] border border-accent/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent text-black font-bold flex items-center justify-center text-xs">
                ✓
              </span>
              <span className="text-xs font-bold text-text-primary">
                Bridge Complete • Received ~{formatNumber(receivedCook || expectedDestCook, 1)} COOK
              </span>
            </div>
            <span className="text-[10px] font-bold text-accent px-2 py-0.5 rounded-full bg-accent/10 border border-accent/30">
              {destChainName}
            </span>
          </div>

          <p className="text-[11px] text-text-secondary leading-normal">
            {isCookieToSolana ? (
              <>
                Funds arrived in your Solana wallet. Switch Nightly to <strong>Solana</strong> to view and use your COOK (Token-2022).
              </>
            ) : (
              <>
                Funds arrived in your Cookie Chain wallet. Switch Nightly to <strong>Cookie Chain</strong> to trade.
              </>
            )}
          </p>

          {/* Explorer Links */}
          <div className="flex items-center gap-3 text-[11px] font-mono border-t border-border/50 pt-2">
            {txHash && (
              <a
                href={isCookieToSolana ? `https://cookiescan.io/tx/${txHash}` : `https://solscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-text-secondary hover:text-text-primary flex items-center gap-1"
              >
                <span>{sourceChainName} Tx</span>
                <i className="ri-external-link-line" />
              </a>
            )}
            {destTxHash && (
              <a
                href={isCookieToSolana ? `https://solscan.io/tx/${destTxHash}` : `https://cookiescan.io/tx/${destTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-accent hover:opacity-80 flex items-center gap-1"
              >
                <span>{destChainName} Delivery</span>
                <i className="ri-external-link-line" />
              </a>
            )}
            {uniqueMessageAccount && (
              <a
                href={
                  uniqueMessageAccount.startsWith("0x")
                    ? `https://explorer.hyperlane.xyz/message/${uniqueMessageAccount}`
                    : "https://explorer.hyperlane.xyz"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-text-muted hover:text-text-primary flex items-center gap-1"
              >
                <span>Hyperlane</span>
                <i className="ri-external-link-line" />
              </a>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-0.5">
            {!isCookieToSolana ? (
              <button
                onClick={() => router.push("/swap")}
                className="flex-1 py-2.5 rounded-full bg-accent text-black font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Trade on Cookie Chain</span>
                <i className="ri-arrow-right-line" />
              </button>
            ) : (
              <a
                href={`https://solscan.io/account/${effectiveRecipient}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-full bg-secondary text-black font-bold text-xs hover:bg-secondary-muted transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View on Solscan</span>
                <i className="ri-external-link-line" />
              </a>
            )}
            <button
              onClick={() => {
                setTransferStatus("idle");
                setStatusMessage(null);
                setAmount("");
                setSolQuote(null);
              }}
              className="px-4 py-2.5 rounded-full bg-[#141720] border border-border text-text-muted hover:text-text-primary text-xs font-semibold cursor-pointer"
            >
              Bridge More
            </button>
          </div>
        </div>
      )}

      {/* ─── ACTION BUTTON (Hidden when already delivered) ─── */}
      {transferStatus === "delivered" ? null : !connected ? (
        <button
          onClick={() => setWalletModalOpen(true)}
          className="w-full py-3.5 rounded-full font-bold text-sm bg-bg-elevated text-secondary border border-secondary/40 hover:bg-secondary/15 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
        >
          <i className="ri-wallet-3-line" />
          <span>Connect Wallet to Bridge</span>
        </button>
      ) : transferStatus === "preparing" ||
        transferStatus === "signing" ||
        transferStatus === "broadcasting" ||
        transferStatus === "source_confirming" ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-secondary/80 text-black cursor-wait flex items-center justify-center gap-2 select-none"
        >
          <i className="ri-loader-4-line animate-spin" />
          <span>
            {transferStatus === "signing" ? "Approve in Wallet..." : "Processing Transaction..."}
          </span>
        </button>
      ) : transferStatus === "awaiting_delivery" ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-warning/20 border border-warning/40 text-warning cursor-wait flex items-center justify-center gap-2 select-none"
        >
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span>Relaying to Destination Chain...</span>
        </button>
      ) : transferStatus === "error" ? (
        <button
          onClick={handleBridge}
          className="w-full py-3.5 rounded-full font-bold text-sm bg-error/20 border border-error/40 text-error hover:bg-error/30 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
        >
          <i className="ri-refresh-line" />
          <span>Retry Bridge</span>
        </button>
      ) : !amount || Number(amount) <= 0 ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#141720] border border-border text-text-muted cursor-not-allowed select-none"
        >
          Enter Amount
        </button>
      ) : Number(amount) > effectiveSourceBalance ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#141720] border border-error/30 text-error/80 cursor-not-allowed select-none"
        >
          Insufficient {isSolMode ? "SOL" : "COOK"}
        </button>
      ) : isSolGasInsufficient ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#141720] border border-warning/30 text-warning cursor-not-allowed select-none"
        >
          Reserve 0.008 SOL for gas
        </button>
      ) : exceedsCollateral ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#141720] border border-warning/30 text-warning cursor-not-allowed select-none"
        >
          Exceeds Destination Reserve
        </button>
      ) : isSolMode && loadingSolQuote ? (
        <button
          disabled
          className="w-full py-3.5 rounded-full font-bold text-sm bg-[#141720] border border-secondary/40 text-secondary cursor-wait select-none"
        >
          <i className="ri-loader-4-line animate-spin" />
          <span>Fetching Quote...</span>
        </button>
      ) : (
        <button
          onClick={handleBridge}
          className="w-full py-3.5 rounded-full font-black text-sm uppercase tracking-wide bg-secondary text-black hover:bg-secondary-muted transition-all flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99]"
        >
          <i className="ri-arrow-left-right-line" />
          <span>
            {isSolMode
              ? `Bridge ${amount} SOL → Cookie`
              : `Bridge ${amount} COOK`}
          </span>
        </button>
      )}

      {/* Micro Footer Link */}
      <div className="pt-0.5 text-center">
        <a
          href={OFFICIAL_BRIDGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-text-muted hover:text-secondary inline-flex items-center gap-1 transition-colors"
        >
          <span>Hyperlane Warp Route</span>
          <i className="ri-external-link-line text-[10px]" />
        </a>
      </div>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
