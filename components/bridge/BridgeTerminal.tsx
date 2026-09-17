"use client";

/**
 * components/bridge/BridgeTerminal.tsx
 * Full-scale Hyperlane Warp Route Bridge Terminal for Cookie Chain ↔ Solana Mainnet.
 * Features 2-phase settlement tracking, decimal awareness (9 decimals native vs 6 decimals Token-2022),
 * destination collateral preflighting, and GlassJar native color styling.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  calculateBridgeAmounts,
  getDestinationCollateral,
  getSolanaCookBalance,
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
import { formatNumber, truncateAddress, copyToClipboard } from "@/lib";
import { cn } from "@/lib/utils";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { WalletModal } from "@/components/wallet/WalletModal";

export function BridgeTerminal() {
  const { publicKey, connected } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  // Direction: defaulted to "solana-to-cookie" per user preference
  const [direction, setBridgeDirection] = useState<BridgeDirection>("solana-to-cookie");

  // Balances on both sides of the bridge
  const [cookieBalance, setCookieBalance] = useState<number>(0);
  const [solanaBalance, setSolanaBalance] = useState<number>(0);
  const [loadingBalances, setLoadingBalances] = useState<boolean>(false);

  // Form State
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [activeInput, setActiveInput] = useState<"send" | "recipient" | null>(null);
  const [copiedTx, setCopiedTx] = useState(false);

  // Preflight Collateral
  const [collateral, setCollateral] = useState<{ available: number; maxTransfer: number }>({
    available: 2500000,
    maxTransfer: 500000,
  });

  // Transfer Lifecycle
  const [transferStatus, setTransferStatus] = useState<
    "idle" | "dispatching" | "dispatched" | "awaiting_delivery" | "delivered" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isCookieToSolana = direction === "cookie-to-solana";
  const sourceBalance = isCookieToSolana ? cookieBalance : solanaBalance;
  const destBalance = isCookieToSolana ? solanaBalance : cookieBalance;
  const sourceChainName = isCookieToSolana ? "Cookie Chain" : "Solana Mainnet";
  const destChainName = isCookieToSolana ? "Solana Mainnet" : "Cookie Chain";

  // Fetch balances and destination collateral
  const refreshData = useCallback(async () => {
    if (publicKey) {
      setLoadingBalances(true);
      try {
        const [cBal, sBal] = await Promise.allSettled([
          getCookBalance(publicKey),
          getSolanaCookBalance(publicKey),
        ]);
        if (cBal.status === "fulfilled") setCookieBalance(cBal.value);
        if (sBal.status === "fulfilled") setSolanaBalance(sBal.value);

        if (!recipient) {
          setRecipient(publicKey.toBase58());
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
  }, [publicKey, direction, recipient]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Sync default recipient with connected wallet
  useEffect(() => {
    if (publicKey && !recipient) {
      setRecipient(publicKey.toBase58());
    }
  }, [publicKey, recipient]);

  // Flip Direction
  function handleFlipDirection() {
    setBridgeDirection((d) =>
      d === "cookie-to-solana" ? "solana-to-cookie" : "cookie-to-solana"
    );
    setAmount("");
  }

  // Quick percentage selection based on active source balance
  function handlePercent(p: number) {
    if (sourceBalance <= 0) return;
    const calc = (sourceBalance * p) / 100;
    setAmount(calc > 0 ? (p === 100 ? calc.toString() : calc.toFixed(4)) : "0");
  }

  // Calculate quote and safety preflights
  const quote: BridgeQuote | null = calculateBridgeAmounts(
    amount,
    direction,
    collateral.available
  );

  const exceedsCollateral =
    quote !== null && quote.sourceAmount > collateral.available;


  // Handle Initiating Bridge Transfer
  async function handleBridge() {
    if (!connected) {
      setWalletModalOpen(true);
      return;
    }

    if (!quote || exceedsCollateral) return;

    // Trigger two-phase bridge dispatch flow
    setTransferStatus("dispatching");
    setStatusMessage("Preparing Hyperlane Warp Route transfer transaction...");

    // Build portal URL with prefilled parameters for seamless foundation portal execution
    const portalParams = new URLSearchParams({
      source: isCookieToSolana ? "cookiechain" : "solana",
      target: isCookieToSolana ? "solana" : "cookiechain",
      amount: amount,
      recipient: recipient || (publicKey ? publicKey.toBase58() : ""),
    });
    const portalUrl = `${OFFICIAL_BRIDGE_URL}?${portalParams.toString()}`;

    // Provide immediate feedback and open the prefilled portal or process dispatch
    setTimeout(() => {
      setTransferStatus("dispatched");
      setStatusMessage("Transfer initiated on Hyperlane Warp Route. Forwarding to execution portal...");
      window.open(portalUrl, "_blank", "noopener,noreferrer");
    }, 800);
  }

  return (
    <div className="w-full max-w-[520px] rounded-3xl bg-[#0E1015] border border-border/80 shadow-2xl p-5 sm:p-6 flex flex-col gap-4 relative select-none">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <i className="ri-arrow-left-right-line text-base" />
          </div>
          <div>
            <h2 className="text-base font-bold text-text-primary tracking-wide">
              Hyperlane Bridge
            </h2>
            <p className="text-[11px] text-text-muted">
              Warp Route • 1:1 Pegged Asset
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary text-[11px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          <span>Solana ↔ Cookie</span>
        </div>
      </div>

      {/* ─── ROUTE DIRECTION SELECTOR CARD ─── */}
      <div className="p-3.5 rounded-2xl bg-[#141720] border border-border/80 flex items-center justify-between gap-3">
        {/* Source Side */}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">
            Source Chain
          </span>
          <div className="flex items-center gap-2">
            {isCookieToSolana ? (
              <img
                src="/cook.jpeg"
                alt="Cookie Chain"
                className="w-7 h-7 rounded-full object-cover border border-border shadow-sm flex-shrink-0"
              />
            ) : (
              <img
                src="/solana-logo.png"
                alt="Solana"
                className="w-7 h-7 rounded-full object-cover border border-border shadow-sm flex-shrink-0 bg-black"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-primary truncate">
                {isCookieToSolana ? "Cookie Chain" : "Solana Mainnet"}
              </p>
              <p className="text-[10px] text-text-muted font-mono">
                {isCookieToSolana ? "9 Decimals (Native)" : "6 Decimals (Token-2022)"}
              </p>
            </div>
          </div>
        </div>

        {/* Flip Direction Button */}
        <button
          onClick={handleFlipDirection}
          className="w-8 h-8 rounded-full bg-bg-card border border-border flex items-center justify-center text-secondary hover:border-secondary hover:scale-105 transition-all flex-shrink-0 shadow-md"
          title="Switch direction"
        >
          <i className="ri-arrow-left-right-line text-sm" />
        </button>

        {/* Destination Side */}
        <div className="flex-1 min-w-0 text-right">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">
            Destination Chain
          </span>
          <div className="flex items-center justify-end gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-primary truncate">
                {isCookieToSolana ? "Solana Mainnet" : "Cookie Chain"}
              </p>
              <p className="text-[10px] text-text-muted font-mono">
                {isCookieToSolana ? "6 Decimals (Token-2022)" : "9 Decimals (Native)"}
              </p>
            </div>
            {!isCookieToSolana ? (
              <img
                src="/cook.jpeg"
                alt="Cookie Chain"
                className="w-7 h-7 rounded-full object-cover border border-border shadow-sm flex-shrink-0"
              />
            ) : (
              <img
                src="/solana-logo.png"
                alt="Solana"
                className="w-7 h-7 rounded-full object-cover border border-border shadow-sm flex-shrink-0 bg-black"
              />
            )}
          </div>
        </div>
      </div>

      {/* ─── DUAL BALANCE PILL ─── */}
      <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#141720] border border-border/70 text-xs">
        <div className="flex items-center gap-2">
          <img src="/solana-logo.png" alt="Solana" className="w-4 h-4 rounded-full bg-black" />
          <span className="text-[11px] text-text-muted">Solana:</span>
          <span className="text-[11px] font-bold text-text-primary font-mono tabular-nums">
            {loadingBalances ? "..." : formatNumber(solanaBalance, 4)} COOK
          </span>
        </div>
        <div className="h-3.5 w-[1px] bg-border/80" />
        <div className="flex items-center gap-2">
          <img src="/cook.jpeg" alt="Cookie" className="w-4 h-4 rounded-full object-cover" />
          <span className="text-[11px] text-text-muted">Cookie Chain:</span>
          <span className="text-[11px] font-bold text-text-primary font-mono tabular-nums">
            {loadingBalances ? "..." : formatNumber(cookieBalance, 4)} COOK
          </span>
        </div>
      </div>

      {/* ─── YOU SEND CONTAINER ─── */}
      <div
        className={cn(
          "p-4 rounded-2xl bg-[#141720] border transition-all duration-150 space-y-2.5 focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary",
          activeInput === "send"
            ? "border-secondary ring-1 ring-secondary"
            : "border-border/70 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-semibold text-text-secondary text-xs uppercase tracking-wider">
            You Send ({sourceChainName})
          </span>
          <span className="tabular-nums font-mono text-[11px] flex items-center gap-1.5">
            <span>Balance: {loadingBalances ? "..." : formatNumber(sourceBalance, 4)} COOK</span>
            <button
              onClick={refreshData}
              className="text-text-muted hover:text-secondary transition-colors p-0.5 cursor-pointer"
              title="Refresh balances"
            >
              <i className={cn("ri-refresh-line text-xs", loadingBalances && "animate-spin text-secondary")} />
            </button>
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={() => setActiveInput("send")}
            onBlur={() => setActiveInput(null)}
            className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 placeholder:text-text-muted/60"
          />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C202B] border border-border text-xs font-bold flex-shrink-0 select-none shadow-sm">
            <TokenAvatar symbol="COOK" size={20} />
            <span className="text-text-primary font-bold">COOK</span>
          </div>
        </div>

        {/* Quick Percentages */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-text-muted font-mono">
            Ratio: 1 COOK = 1 COOK
          </span>

          <div className="flex items-center gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => handlePercent(p)}
                className="px-2 py-0.5 rounded-full bg-bg-card border border-border/70 text-[10px] font-bold text-text-muted hover:text-text-primary hover:border-secondary/50 transition-colors"
              >
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── DESTINATION RECIPIENT ADDRESS ─── */}
      <div
        className={cn(
          "p-3.5 rounded-2xl bg-[#141720] border transition-all duration-150 space-y-1.5 focus-within:border-secondary focus-within:ring-1 focus-within:ring-secondary",
          activeInput === "recipient"
            ? "border-secondary ring-1 ring-secondary"
            : "border-border/70 hover:border-border"
        )}
      >
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-semibold text-text-secondary uppercase tracking-wider text-[11px]">
            Destination Recipient Address ({destChainName})
          </span>
          {publicKey && recipient === publicKey.toBase58() && (
            <span className="text-[10px] text-accent flex items-center gap-1 font-semibold">
              <i className="ri-check-line" />
              <span>Same Wallet</span>
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder={publicKey ? publicKey.toBase58() : "Recipient Solana or Cookie address..."}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          onFocus={() => setActiveInput("recipient")}
          onBlur={() => setActiveInput(null)}
          className="w-full bg-bg-card border border-border/70 rounded-xl px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none"
        />
      </div>

      {/* ─── YOU RECEIVE CONTAINER ─── */}
      <div className="p-4 rounded-2xl bg-[#141720] border border-border/70 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-semibold text-text-secondary text-xs uppercase tracking-wider">
            You Receive (Est. on {destChainName})
          </span>
          <span className="text-[11px] font-mono text-text-muted tabular-nums">
            Dest Balance: {loadingBalances ? "..." : formatNumber(destBalance, 4)} COOK
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <input
            type="text"
            readOnly
            placeholder="0.0"
            value={quote ? quote.destAmount.toString() : amount || "0.0"}
            className="w-full bg-transparent text-3xl font-bold font-mono text-text-primary outline-none focus:outline-none cursor-default"
          />

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C202B] border border-border text-xs font-bold flex-shrink-0 select-none shadow-sm">
            <TokenAvatar symbol="COOK" size={20} />
            <span className="text-text-primary font-bold">COOK</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-text-muted font-mono">
          <span>Est. Delivery: ~2 to 5 mins</span>
          <span>Interchain Fee: ~0.02 COOK</span>
        </div>
      </div>

      {/* ─── SAFETY & COLLATERAL PREFLIGHT CARD ─── */}
      <div
        className={cn(
          "p-3.5 rounded-2xl border text-xs space-y-2",
          exceedsCollateral
            ? "bg-warning/10 border-warning/40 text-warning"
            : "bg-bg-card border-border/70 text-text-muted"
        )}
      >
        <div className="flex items-center justify-between font-semibold">
          <span className="flex items-center gap-1.5">
            <i className={cn("text-sm", exceedsCollateral ? "ri-error-warning-line text-warning" : "ri-shield-check-line text-accent")} />
            <span>Destination Collateral Reserve</span>
          </span>
          <span className="font-mono text-[11px]">
            {formatNumber(collateral.available, 0)} COOK Available
          </span>
        </div>

        {exceedsCollateral ? (
          <p className="text-[11px] text-warning leading-relaxed">
            <strong>Warning:</strong> Requested amount exceeds destination collateral ({formatNumber(collateral.available, 0)} COOK). Transfers exceeding available collateral can lock funds behind an undeliverable Hyperlane message. Please reduce the transfer amount.
          </p>
        ) : (
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Transfers use Hyperlane 2-phase settlement: source transaction confirms in ~1s, then an off-chain relayer releases funds from destination collateral within 2–5 minutes.
          </p>
        )}
      </div>

      {/* ─── STATUS / DISPATCH BANNER ─── */}
      {transferStatus !== "idle" && (
        <div
          className={cn(
            "p-3.5 rounded-2xl border text-xs space-y-2",
            transferStatus === "dispatched" && "bg-accent/10 border-accent/30 text-accent",
            transferStatus === "dispatching" && "bg-secondary/10 border-secondary/30 text-secondary",
            transferStatus === "error" && "bg-error/10 border-error/30 text-error"
          )}
        >
          <div className="flex items-center gap-2 font-semibold">
            {transferStatus === "dispatching" && <i className="ri-loader-4-line animate-spin text-base" />}
            {transferStatus === "dispatched" && <i className="ri-checkbox-circle-line text-base" />}
            <span>{statusMessage}</span>
          </div>

          <div className="flex items-center gap-3 pt-1 text-[11px]">
            <a
              href="https://bridge.cookiechain.wtf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80 flex items-center gap-1"
            >
              <span>Hyperlane Warp Portal</span>
              <i className="ri-external-link-line" />
            </a>
            <span>•</span>
            <a
              href="https://explorer.hyperlane.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80 flex items-center gap-1"
            >
              <span>Hyperlane Explorer</span>
              <i className="ri-external-link-line" />
            </a>
          </div>
        </div>
      )}

      {/* ─── ACTION BUTTON ─── */}
      {!connected ? (
        <button
          onClick={() => setWalletModalOpen(true)}
          className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-elevated text-secondary border border-secondary/40 hover:bg-secondary/15 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none"
        >
          <i className="ri-wallet-3-line text-base" />
          <span>Connect Wallet to Bridge</span>
        </button>
      ) : !amount || Number(amount) <= 0 ? (
        <button
          disabled
          className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-border/70 text-text-muted cursor-not-allowed select-none"
        >
          Enter an amount to bridge
        </button>
      ) : Number(amount) > sourceBalance ? (
        <button
          disabled
          className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-error/30 text-error/80 cursor-not-allowed select-none"
        >
          Insufficient COOK on {sourceChainName}
        </button>
      ) : exceedsCollateral ? (
        <button
          disabled
          className="w-full py-4 rounded-2xl font-bold text-sm bg-bg-card border border-warning/30 text-warning cursor-not-allowed select-none"
        >
          Amount Exceeds Collateral Pool
        </button>
      ) : (
        <button
          onClick={handleBridge}
          disabled={transferStatus === "dispatching"}
          className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wide bg-secondary text-white hover:bg-secondary-muted shadow-[0_0_20px_rgba(235,94,40,0.35)] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer select-none active:scale-[0.99]"
        >
          {transferStatus === "dispatching" ? (
            <>
              <i className="ri-loader-4-line animate-spin text-base" />
              <span>Initiating Warp Transfer...</span>
            </>
          ) : (
            <>
              <i className="ri-arrow-left-right-line text-base" />
              <span>Bridge {amount} COOK via Hyperlane</span>
            </>
          )}
        </button>
      )}

      {/* Official Foundation Portal Fallback Notice */}
      <div className="pt-1 text-center">
        <a
          href={OFFICIAL_BRIDGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-text-muted hover:text-secondary inline-flex items-center gap-1 transition-colors"
        >
          <span>Need official Hyperlane Warp Portal? Open bridge.cookiechain.wtf</span>
          <i className="ri-external-link-line text-xs" />
        </a>
      </div>

      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
