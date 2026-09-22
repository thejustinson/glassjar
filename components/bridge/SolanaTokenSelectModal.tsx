"use client";

/**
 * components/bridge/SolanaTokenSelectModal.tsx
 * Modal for selecting any Solana token (SOL, USDC, USDT, COOK, or any SPL token)
 * to Zap Bridge into native COOK on Cookie Chain.
 */

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PublicKey } from "@solana/web3.js";
import {
  POPULAR_SOLANA_TOKENS,
  type SolanaToken,
  NATIVE_SOL_MINT,
  SOLANA_WARP_MINT,
  getSolanaTokenBalance,
} from "@/lib/bridge";
import { formatNumber, truncateAddress } from "@/lib";
import { cn } from "@/lib/utils";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

const EXTENDED_SOLANA_TOKENS: SolanaToken[] = [
  ...POPULAR_SOLANA_TOKENS,
  {
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    symbol: "JUP",
    name: "Jupiter",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png",
  },
  {
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png",
  },
  {
    mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
    symbol: "WIF",
    name: "dogwifhat",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm/logo.png",
  },
  {
    mint: "HZ1JovNiPvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
    symbol: "PYTH",
    name: "Pyth Network",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HZ1JovNiPvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3/logo.png",
  },
  {
    mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    symbol: "RAY",
    name: "Raydium",
    decimals: 6,
    logoUri: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png",
  },
];

interface SolanaTokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: SolanaToken) => void;
  selectedMint?: string;
  userPublicKey?: PublicKey | null;
}

export function SolanaTokenSelectModal({
  isOpen,
  onClose,
  onSelect,
  selectedMint,
  userPublicKey,
}: SolanaTokenSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [tokenBalances, setTokenBalances] = useState<Record<string, number>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Custom CA state
  const [customToken, setCustomToken] = useState<SolanaToken | null>(null);
  const [customSearching, setCustomSearching] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch balances for popular tokens whenever modal opens
  useEffect(() => {
    if (!isOpen || !userPublicKey) return;

    let isSubscribed = true;
    setLoadingBalances(true);

    async function loadBalances() {
      const balances: Record<string, number> = {};
      const promises = EXTENDED_SOLANA_TOKENS.map(async (tok) => {
        try {
          const bal = await getSolanaTokenBalance(userPublicKey!, tok.mint);
          balances[tok.mint] = bal;
        } catch {
          balances[tok.mint] = 0;
        }
      });

      await Promise.allSettled(promises);
      if (isSubscribed) {
        setTokenBalances(balances);
        setLoadingBalances(false);
      }
    }

    loadBalances();

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, userPublicKey]);

  // Reset query on close
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setCustomToken(null);
      setCustomError(null);
      setCustomSearching(false);
    }
  }, [isOpen]);

  // Custom CA lookup
  useEffect(() => {
    const trimmed = query.trim();
    const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

    if (isBase58) {
      // Check if already in list
      const existing = EXTENDED_SOLANA_TOKENS.find(
        (t) => t.mint.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        setCustomToken(existing);
        setCustomError(null);
        return;
      }

      setCustomSearching(true);
      setCustomError(null);

      // Probe balance & decimals via our backend proxy
      const addr = userPublicKey ? userPublicKey.toBase58() : "11111111111111111111111111111111";
      fetch(`/api/solana-balance?address=${addr}&mint=${trimmed}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error && !data.success) {
            setCustomError("Could not resolve mint on Solana");
            setCustomToken(null);
          } else {
            const detectedDecimals = typeof data.decimals === "number" ? data.decimals : 6;
            const custom: SolanaToken = {
              mint: trimmed,
              symbol: `SPL-${trimmed.slice(0, 4)}`,
              name: `Custom Mint (${truncateAddress(trimmed, 4)})`,
              decimals: detectedDecimals,
            };
            setCustomToken(custom);
            if (typeof data.balance === "number") {
              setTokenBalances((prev) => ({ ...prev, [trimmed]: data.balance }));
            }
          }
        })
        .catch(() => {
          setCustomError("Lookup failed");
          setCustomToken(null);
        })
        .finally(() => setCustomSearching(false));
    } else {
      setCustomToken(null);
      setCustomSearching(false);
      setCustomError(null);
    }
  }, [query, userPublicKey]);

  // Filtered tokens
  const filtered = useMemo(() => {
    if (!query.trim()) return EXTENDED_SOLANA_TOKENS;
    const q = query.toLowerCase().trim();

    return EXTENDED_SOLANA_TOKENS.filter((t) => {
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Close on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-md bg-[#0E1015] border border-border squircle-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/80">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-text-primary">Select Solana Source Token</h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30 text-[10px] font-bold">
                  Zap Bridge
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-border/60 bg-[#141720]/50 space-y-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search token name, symbol, or paste Solana mint..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-bg-card border border-border text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-secondary transition-colors"
                />
              </div>

              {/* Popular Quick Chips */}
              {!query && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {POPULAR_SOLANA_TOKENS.map((t) => {
                    const isSelected = selectedMint === t.mint;
                    return (
                      <button
                        key={t.mint}
                        onClick={() => {
                          onSelect(t);
                          onClose();
                        }}
                        className={cn(
                          "h-7 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-pointer",
                          isSelected
                            ? "bg-secondary text-black border-secondary font-bold"
                            : "bg-[#141720] border-border text-text-secondary hover:text-text-primary hover:border-secondary/50"
                        )}
                      >
                        <TokenAvatar logoUri={t.logoUri} symbol={t.symbol} size={15} />
                        <span>{t.symbol}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/30 p-2 min-h-[260px]">
              {customSearching && (
                <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin text-secondary text-base" />
                  <span>Looking up token mint on Solana...</span>
                </div>
              )}

              {customError && !customSearching && (
                <div className="p-3 text-center text-xs text-error/80 bg-error/10 border border-error/20 rounded-xl m-2">
                  {customError}
                </div>
              )}

              {customToken && !customSearching && (
                <div className="p-2 mb-2 rounded-xl bg-secondary/10 border border-secondary/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-secondary px-2 mb-1">
                    Custom Mint Address
                  </div>
                  <SolanaTokenRow
                    token={customToken}
                    isSelected={selectedMint === customToken.mint}
                    balance={tokenBalances[customToken.mint]}
                    onSelect={() => {
                      onSelect(customToken);
                      onClose();
                    }}
                  />
                </div>
              )}

              {filtered.length === 0 && !customToken && !customSearching ? (
                <div className="py-12 text-center text-xs text-text-muted space-y-2">
                  <div className="w-10 h-10 mx-auto relative opacity-30 mb-2">
                    <Image src="/logo.png" alt="GlassJar" fill className="object-contain" />
                  </div>
                  <p className="font-semibold text-text-secondary">No matching tokens found</p>
                  <p>Try searching by ticker or paste any Solana SPL mint address.</p>
                </div>
              ) : (
                filtered.map((t) => (
                  <SolanaTokenRow
                    key={t.mint}
                    token={t}
                    isSelected={selectedMint === t.mint}
                    balance={tokenBalances[t.mint]}
                    onSelect={() => {
                      onSelect(t);
                      onClose();
                    }}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

function SolanaTokenRow({
  token,
  isSelected,
  balance,
  onSelect,
}: {
  token: SolanaToken;
  isSelected: boolean;
  balance?: number;
  onSelect: () => void;
}) {
  const isWarpCook = token.mint === SOLANA_WARP_MINT;
  const isSol = token.mint === NATIVE_SOL_MINT;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer group",
        isSelected
          ? "bg-secondary/15 border border-secondary/40"
          : "hover:bg-[#141720] border border-transparent"
      )}
    >
      <div className="flex items-center gap-3">
        <TokenAvatar logoUri={token.logoUri} symbol={token.symbol} size={28} />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary group-hover:text-secondary transition-colors">
              {token.symbol}
            </span>
            {isWarpCook && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold">
                1:1 Bridge
              </span>
            )}
            {isSol && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/20 text-secondary font-bold">
                Native
              </span>
            )}
          </div>
          <div className="text-[10px] text-text-muted truncate max-w-[170px]">
            {token.name}
          </div>
        </div>
      </div>

      <div className="text-right font-mono">
        {balance !== undefined ? (
          <div className="text-xs font-bold text-text-primary">
            {formatNumber(balance, token.decimals > 6 ? 4 : 2)}
          </div>
        ) : null}
        <div className="text-[10px] text-text-muted">
          {truncateAddress(token.mint, 4)}
        </div>
      </div>
    </button>
  );
}
