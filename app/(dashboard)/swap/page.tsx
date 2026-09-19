"use client";

/**
 * app/(dashboard)/swap/page.tsx
 * Focused GlassJar Swap Terminal for Cookie Chain.
 * Features swap form on left and vertically stacked token extend cards on right.
 */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { SwapTerminal } from "@/components/swap/SwapTerminal";
import { NATIVE_COOK_TOKEN } from "@/components/swap/TokenSelectModal";
import { getTokenByMint, getCookPrice, type Token } from "@/lib/das";
import { getCookBalance } from "@/lib/chain";
import {
  formatPrice,
  formatPct,
  formatNumber,
  deltaColorClass,
  truncateAddress,
  copyToClipboard,
} from "@/lib";
import { cn } from "@/lib/utils";
import { WalletModal } from "@/components/wallet/WalletModal";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

export default function SwapPage() {
  return (
    <Suspense fallback={<SwapPageSkeleton />}>
      <SwapPageContent />
    </Suspense>
  );
}

function SwapPageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
      <div className="w-full max-w-[480px] h-[480px] bg-bg-card rounded-3xl animate-pulse" />
    </div>
  );
}

function SwapPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicKey, connected } = useWallet();

  const inputMintParam = searchParams.get("inputMint");
  const outputMintParam = searchParams.get("outputMint");

  const [inputToken, setInputToken] = useState<Token>(NATIVE_COOK_TOKEN);
  const [outputToken, setOutputToken] = useState<Token>({
    mint: "3Dk9AYeoMZRHg9PmA2LrxrDGyJsNPTVGbRMbNKCsEt23",
    symbol: "TRS",
    name: "Trash",
    decimals: 6,
    logoUri: "https://ipfs.io/ipfs/QmaMg8bUEKsC6qX1fmrNU8EcfYSpA78eTsGoSpYpRfMNcV",
    price: 0.000034,
    priceChange24h: 0,
    marketCap: 3792000,
  });

  const [cookUsd, setCookUsd] = useState<number | null>(null);
  const [walletCookBal, setWalletCookBal] = useState<number>(0);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);

  // Load URL query params if present
  useEffect(() => {
    async function loadParams() {
      if (inputMintParam) {
        const t = await getTokenByMint(inputMintParam);
        if (t) setInputToken(t);
      }
      if (outputMintParam) {
        const t = await getTokenByMint(outputMintParam);
        if (t) setOutputToken(t);
      }
    }
    loadParams();
  }, [inputMintParam, outputMintParam]);

  // Load COOK price & wallet balance
  useEffect(() => {
    getCookPrice().then((price) => {
      setCookUsd(price);
      if (inputToken.mint === NATIVE_COOK_TOKEN.mint && price) {
        setInputToken((prev) => ({ ...prev, price }));
      }
    });

    if (publicKey) {
      getCookBalance(publicKey).then((b) => setWalletCookBal(b));
    }
  }, [publicKey, inputToken.mint]);

  function handleInvertPair() {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
  }

  async function handleCopy(e: React.MouseEvent, mint: string) {
    e.stopPropagation();
    await copyToClipboard(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1500);
  }

  return (
    <div className="relative min-h-[82vh] flex flex-col items-center justify-center py-6 px-4 sm:px-6 select-none">
      {/* Subtle dotted grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(142, 146, 160, 0.15) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main Content Layout: Swap Terminal on Left, Token Extend Containers Vertically Stacked on Right */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* ─── LEFT: FOCUSED SWAP TERMINAL ─── */}
        <div className="w-full max-w-[480px]">
          <SwapTerminal
            inputToken={inputToken}
            outputToken={outputToken}
            onSelectInputToken={setInputToken}
            onSelectOutputToken={setOutputToken}
            onInvertPair={handleInvertPair}
          />
        </div>

        {/* ─── RIGHT: TOKEN EXTEND CONTAINERS VERTICALLY STACKED ─── */}
        <div className="w-full max-w-[480px] lg:w-80 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <i className="ri-line-chart-line text-accent text-sm" />
              <span>Token Terminals</span>
            </span>
            <span className="text-[11px] text-text-muted">
              Click to view chart
            </span>
          </div>

          {/* Pay Token Extend Card */}
          <div
            onClick={() => router.push(`/token/${inputToken.mint}`)}
            className="p-4 rounded-3xl bg-[#0E1015] border border-border/80 hover:border-accent/50 hover:bg-[#12151D] transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-xl"
            title={`Open ${inputToken.symbol} trading terminal`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <TokenAvatar
                  logoUri={inputToken.logoUri}
                  symbol={inputToken.symbol}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                      {inputToken.symbol}
                    </span>
                    <span className="text-[10px] font-semibold text-text-muted px-1.5 py-0.5 rounded bg-bg-card border border-border">
                      Pay
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted font-mono block">
                    {truncateAddress(inputToken.mint, 4)}
                  </span>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors flex-shrink-0">
                <i className="ri-arrow-right-up-line text-xs" />
              </div>
            </div>

            <div className="flex items-baseline justify-between border-t border-border/60 pt-2.5 text-xs">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Price</span>
                <span className="font-mono font-bold text-sm text-text-primary">
                  {inputToken.price !== undefined ? formatPrice(inputToken.price) : "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">24h Change</span>
                {inputToken.priceChange24h !== undefined ? (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums font-mono",
                      deltaColorClass(inputToken.priceChange24h)
                    )}
                  >
                    {formatPct(inputToken.priceChange24h)}
                  </span>
                ) : (
                  <span className="text-text-muted font-mono text-xs">—</span>
                )}
              </div>
            </div>
          </div>

          {/* Receive Token Extend Card */}
          <div
            onClick={() => router.push(`/token/${outputToken.mint}`)}
            className="p-4 rounded-3xl bg-[#0E1015] border border-border/80 hover:border-accent/50 hover:bg-[#12151D] transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-xl"
            title={`Open ${outputToken.symbol} trading terminal`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <TokenAvatar
                  logoUri={outputToken.logoUri}
                  symbol={outputToken.symbol}
                  size={32}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                      {outputToken.symbol}
                    </span>
                    <span className="text-[10px] font-semibold text-text-muted px-1.5 py-0.5 rounded bg-bg-card border border-border">
                      Receive
                    </span>
                  </div>
                  <span className="text-[11px] text-text-muted font-mono block">
                    {truncateAddress(outputToken.mint, 4)}
                  </span>
                </div>
              </div>

              <div className="w-7 h-7 rounded-full bg-bg-card border border-border flex items-center justify-center text-text-muted group-hover:text-accent group-hover:border-accent/40 transition-colors flex-shrink-0">
                <i className="ri-arrow-right-up-line text-xs" />
              </div>
            </div>

            <div className="flex items-baseline justify-between border-t border-border/60 pt-2.5 text-xs">
              <div>
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">Price</span>
                <span className="font-mono font-bold text-sm text-text-primary">
                  {outputToken.price !== undefined ? formatPrice(outputToken.price) : "—"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted uppercase tracking-wider block">24h Change</span>
                {outputToken.priceChange24h !== undefined ? (
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums font-mono",
                      deltaColorClass(outputToken.priceChange24h)
                    )}
                  >
                    {formatPct(outputToken.priceChange24h)}
                  </span>
                ) : (
                  <span className="text-text-muted font-mono text-xs">—</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Modal */}
      <WalletModal isOpen={walletModalOpen} onClose={() => setWalletModalOpen(false)} />
    </div>
  );
}
