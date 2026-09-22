"use client";

/**
 * components/swap/TokenSelectModal.tsx
 * Modal for picking an input or output token for the swap terminal.
 * Features quick popular token chips, search by symbol/name, and direct CA lookup.
 */

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getTopTokens, getTokenByMint, type Token } from "@/lib/das";
import { formatPrice, formatPct, deltaColorClass, truncateAddress } from "@/lib";
import { cn } from "@/lib/utils";
import { COOK_MINT } from "@/lib/chain";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

// Native COOK token representation for the swap terminal
export const NATIVE_COOK_TOKEN: Token = {
  mint: COOK_MINT,
  symbol: "COOK",
  name: "Cookie Chain",
  decimals: 9,
  logoUri: "/cook.jpeg",
  price: undefined, // will be filled with live price
};

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedMint?: string;
}

export function TokenSelectModal({
  isOpen,
  onClose,
  onSelect,
  selectedMint,
}: TokenSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [caSearching, setCaSearching] = useState(false);
  const [caToken, setCaToken] = useState<Token | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getTopTokens(150)
        .then((data) => {
          // Prepend native COOK if not already in list, and always pin COOK at index 0
          const cookToken =
            data.find((t) => t.mint === COOK_MINT || t.symbol.toUpperCase() === "COOK") ||
            NATIVE_COOK_TOKEN;
          const others = data.filter(
            (t) => t.mint !== COOK_MINT && t.symbol.toUpperCase() !== "COOK"
          );
          setTokens([cookToken, ...others]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setQuery("");
      setCaToken(null);
    }
  }, [isOpen]);

  // Handle direct CA lookup
  useEffect(() => {
    const trimmed = query.trim();
    const isBase58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

    if (isBase58) {
      const existing = tokens.find((t) => t.mint.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        setCaToken(existing);
        return;
      }

      setCaSearching(true);
      getTokenByMint(trimmed)
        .then((res) => setCaToken(res))
        .finally(() => setCaSearching(false));
    } else {
      setCaToken(null);
      setCaSearching(false);
    }
  }, [query, tokens]);

  // Filtered tokens with COOK prioritized at the top
  const filtered = useMemo(() => {
    if (!query.trim()) return tokens;
    const q = query.toLowerCase().trim();

    return tokens
      .filter((t) => {
        return (
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.mint.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aIsCook = a.symbol.toUpperCase() === "COOK" || a.mint === COOK_MINT;
        const bIsCook = b.symbol.toUpperCase() === "COOK" || b.mint === COOK_MINT;
        if (aIsCook && !bIsCook) return -1;
        if (!aIsCook && bIsCook) return 1;

        const aExact = a.symbol.toLowerCase() === q;
        const bExact = b.symbol.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        const aStarts = a.symbol.toLowerCase().startsWith(q);
        const bStarts = b.symbol.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return (b.volume24h ?? 0) - (a.volume24h ?? 0);
      });
  }, [tokens, query]);

  // Popular tokens for quick selection chips with COOK explicitly first
  const popularTokens = useMemo(() => {
    const symbols = ["COOK", "TRS", "bCOOK", "HAYGUMMY", "TRASHCOIN", "COOKHOUSE"];
    const found = tokens.filter((t) => symbols.includes(t.symbol));
    return found.sort((a, b) => {
      const aIsCook = a.symbol.toUpperCase() === "COOK" || a.mint === COOK_MINT;
      const bIsCook = b.symbol.toUpperCase() === "COOK" || b.mint === COOK_MINT;
      if (aIsCook && !bIsCook) return -1;
      if (!aIsCook && bIsCook) return 1;
      return symbols.indexOf(a.symbol) - symbols.indexOf(b.symbol);
    });
  }, [tokens]);

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative z-10 w-full max-w-md my-auto rounded-2xl bg-[#0E1015] border border-border shadow-2xl shadow-black overflow-hidden flex flex-col max-h-[80vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/70">
              <h3 className="text-base font-bold text-text-primary">Select a Token</h3>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-4 border-b border-border/60 bg-bg/40 space-y-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, symbol, or paste CA..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-bg-card border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
              </div>

              {/* Quick Token Chips */}
              {popularTokens.length > 0 && !query && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {popularTokens.map((t) => {
                    const isCook = t.symbol.toUpperCase() === "COOK" || t.mint === COOK_MINT;
                    return (
                      <button
                        key={t.mint}
                        onClick={() => {
                          onSelect(t);
                          onClose();
                        }}
                        className={cn(
                          "h-7 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all select-none",
                          selectedMint === t.mint
                            ? "bg-accent/25 border-accent text-accent font-bold shadow-sm shadow-accent/20 ring-1 ring-accent/30"
                            : isCook
                            ? "bg-accent/10 border-accent/40 text-accent hover:bg-accent/20"
                            : "bg-bg-card border-border text-text-secondary hover:text-text-primary hover:border-border/80"
                        )}
                      >
                        <TokenAvatar logoUri={t.logoUri} symbol={t.symbol} size={16} />
                        <span>{t.symbol}</span>
                        {isCook && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-accent/20 text-accent font-bold">
                            Native
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/30 p-2 min-h-[260px]">
              {caSearching && (
                <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin text-accent text-base" />
                  <span>Looking up address on Cookie Chain...</span>
                </div>
              )}

              {caToken && !caSearching && (
                <div className="p-2 mb-2 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-accent px-2 mb-1">
                    Contract Address Match
                  </div>
                  <TokenSelectRow
                    token={caToken}
                    isSelected={selectedMint === caToken.mint}
                    onSelect={() => {
                      onSelect(caToken);
                      onClose();
                    }}
                  />
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center text-xs text-text-muted space-y-2">
                  <i className="ri-loader-4-line animate-spin text-accent text-xl block mx-auto" />
                  <p>Loading tokens...</p>
                </div>
              ) : filtered.length === 0 && !caToken && !caSearching ? (
                <div className="py-12 text-center text-xs text-text-muted space-y-2">
                  <div className="w-10 h-10 mx-auto relative opacity-30 mb-2">
                    <Image src="/logo.png" alt="GlassJar" fill className="object-contain" />
                  </div>
                  <p className="font-semibold text-text-secondary">No tokens found</p>
                  <p>Try searching by ticker, name, or paste a Contract Address.</p>
                </div>
              ) : (
                filtered.map((t) => (
                  <TokenSelectRow
                    key={t.mint}
                    token={t}
                    isSelected={selectedMint === t.mint}
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

function TokenSelectRow({
  token,
  isSelected,
  onSelect,
}: {
  token: Token;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const changeClass = deltaColorClass(token.priceChange24h ?? 0);
  const isCook = token.symbol.toUpperCase() === "COOK" || token.mint === COOK_MINT;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-xl transition-all duration-150 text-left group",
        isSelected
          ? "bg-accent/15 border border-accent/30"
          : "hover:bg-bg-elevated border border-transparent"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <TokenAvatar logoUri={token.logoUri} symbol={token.symbol} size={32} />

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
              {token.symbol}
            </span>
            {isCook && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-bold flex items-center gap-1 border border-accent/30">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Native Gas
              </span>
            )}
            {token.launchpad && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-secondary/20 text-secondary font-semibold">
                CURVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="truncate">{token.name}</span>
            <span className="text-[10px] text-text-muted/70 font-mono">
              • {truncateAddress(token.mint, 4)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-right flex flex-col items-end flex-shrink-0">
        <span className="text-xs font-bold font-mono text-text-primary">
          {token.price !== undefined ? formatPrice(token.price) : "—"}
        </span>
        {token.priceChange24h !== undefined && (
          <span className={cn("text-[10px] font-semibold tabular-nums font-mono", changeClass)}>
            {formatPct(token.priceChange24h)}
          </span>
        )}
      </div>
    </button>
  );
}
