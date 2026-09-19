"use client";

/**
 * app/(dashboard)/faucet/page.tsx
 * COOK Faucet — claim free COOK tokens on Cookie Chain.
 * Wallet connection required. One claim per 24 hours (server-enforced).
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { explorerTxUrl } from "@/lib/chain";

const ConnectButton = dynamic(
  () =>
    import("@/components/wallet/ConnectButton").then((m) => m.ConnectButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-40 rounded-full bg-bg-card border border-border animate-pulse" />
    ),
  }
);

interface ClaimResult {
  success: boolean;
  txSignature: string;
  amountCook: number;
  amountUsd: number;
  cookPrice: number;
}

interface RateLimitInfo {
  nextEligibleAt: string;
  lastClaim?: {
    amountUsd: number;
    txSignature: string;
    claimedAt: string;
  };
}

type FaucetState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; result: ClaimResult }
  | { type: "rate_limited"; info: RateLimitInfo }
  | { type: "error"; message: string };

function useCountdown(targetIso: string | null) {
  const [remaining, setRemaining] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!targetIso) {
      setRemaining("");
      return;
    }

    function tick() {
      const diff = new Date(targetIso!).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("now");
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      );
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetIso]);

  return remaining;
}

export default function FaucetPage() {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<FaucetState>({ type: "idle" });

  const countdownTarget =
    state.type === "rate_limited" ? state.info.nextEligibleAt : null;
  const countdown = useCountdown(countdownTarget);

  const handleClaim = useCallback(async () => {
    if (!publicKey) return;

    setState({ type: "loading" });

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
      });

      const data = await res.json();

      if (res.status === 429) {
        setState({
          type: "rate_limited",
          info: {
            nextEligibleAt: data.nextEligibleAt,
            lastClaim: data.lastClaim,
          },
        });
        return;
      }

      if (!res.ok) {
        setState({ type: "error", message: data.error || "Request failed" });
        return;
      }

      setState({ type: "success", result: data });
    } catch (err) {
      setState({
        type: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, [publicKey]);

  // Reset state when wallet disconnects
  useEffect(() => {
    if (!connected) setState({ type: "idle" });
  }, [connected]);

  return (
    <div className="relative min-h-[75vh] flex flex-col items-center justify-center py-8 select-none">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, var(--text-muted) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 squircle-md bg-[#141720] border border-border text-accent mb-4">
            <i className="ri-water-flash-fill text-accent text-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            COOK Faucet
          </h1>
          <p className="text-sm text-text-secondary mt-1.5">
            Claim faucet funds to test GlassJar on Cookie Chain
          </p>
        </div>

        {/* Main Card */}
        <div className="squircle-lg bg-[#0E1015] border border-border overflow-hidden">
          {/* Not Connected */}
          {!connected && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-[#141720] border border-border flex items-center justify-center">
                <i className="ri-wallet-3-line text-text-muted text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  Connect your wallet
                </p>
                <p className="text-xs text-text-muted">
                  Connect your wallet to claim free COOK to test GlassJar
                </p>
              </div>
              <ConnectButton />
            </div>
          )}

          {/* Connected — Idle */}
          {connected && state.type === "idle" && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-[#141720] border border-border flex items-center justify-center text-accent">
                <i className="ri-hand-coin-fill text-accent text-2xl" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  Ready to claim
                </p>
                <p className="text-xs text-text-muted">
                  Claim free COOK to test swaps and features on GlassJar
                </p>
              </div>
              <button
                onClick={handleClaim}
                className="w-full max-w-[280px] h-11 rounded-full bg-accent text-[#08090C] font-bold text-sm tracking-wide hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
              >
                Claim Faucet to Test GlassJar
              </button>
            </div>
          )}

          {/* Loading */}
          {connected && state.type === "loading" && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-[#141720] border border-border flex items-center justify-center animate-pulse">
                <i className="ri-loader-4-line text-accent text-2xl animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  Sending COOK...
                </p>
                <p className="text-xs text-text-muted">
                  Building and confirming transaction
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {connected && state.type === "success" && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <i className="ri-check-line text-green-400 text-3xl" />
              </div>

              <div className="text-center">
                <p className="text-lg font-bold text-text-primary">
                  +{state.result.amountCook.toFixed(4)}{" "}
                  <span className="text-accent">COOK</span>
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  ≈ ${state.result.amountUsd.toFixed(2)} USD
                </p>
              </div>

              <a
                href={explorerTxUrl(state.result.txSignature)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <i className="ri-external-link-line" />
                View transaction
              </a>

              <div className="w-full pt-4 border-t border-border/80">
                <p className="text-[11px] text-text-muted text-center">
                  You can claim again in 24 hours
                </p>
              </div>
            </div>
          )}

          {/* Rate Limited */}
          {connected && state.type === "rate_limited" && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <i className="ri-time-line text-amber-400 text-2xl" />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  Already claimed today
                </p>
                {countdown && countdown !== "now" ? (
                  <p className="text-xs text-text-muted">
                    Next claim in{" "}
                    <span className="font-mono text-text-secondary">
                      {countdown}
                    </span>
                  </p>
                ) : countdown === "now" ? (
                  <button
                    onClick={() => setState({ type: "idle" })}
                    className="text-xs text-accent hover:underline mt-1"
                  >
                    Claim now →
                  </button>
                ) : null}
              </div>

              {state.info.lastClaim?.txSignature && (
                <a
                  href={explorerTxUrl(state.info.lastClaim.txSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
                >
                  <i className="ri-external-link-line" />
                  View last claim
                </a>
              )}
            </div>
          )}

          {/* Error */}
          {connected && state.type === "error" && (
            <div className="p-8 flex flex-col items-center gap-5">
              <div className="w-16 h-16 squircle-md bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <i className="ri-error-warning-line text-red-400 text-2xl" />
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-text-primary mb-1">
                  Faucet is unavailable
                </p>
                <p className="text-xs text-text-muted">
                  Please try again later.
                </p>
              </div>

              <button
                onClick={() => setState({ type: "idle" })}
                className="text-xs text-accent hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Info footer */}
        <div className="mt-4 flex items-start gap-2 px-1">
          <i className="ri-information-line text-text-muted text-sm mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-text-muted leading-relaxed">
            Claim faucet funds to test GlassJar features and swaps on Cookie Chain. One claim per wallet per day.
          </p>
        </div>
      </div>
    </div>
  );
}
