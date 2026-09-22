"use client";

/**
 * components/search/TokenSearchModal.tsx
 * Full-scale token search modal (supports Name, Symbol, and CA / Mint lookup).
 * Can be opened via Ctrl+K / Cmd+K or via search trigger button.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getTopTokens, getTokenByMint, type Token } from "@/lib/das";
import { COOK_MINT } from "@/lib/chain";
import { NATIVE_COOK_TOKEN } from "@/components/swap/TokenSelectModal";
import {
  formatPrice,
  formatPct,
  formatNumber,
  deltaColorClass,
  truncateAddress,
  copyToClipboard,
} from "@/lib";
import { cn } from "@/lib/utils";
import { TokenAvatar } from "@/components/ui/TokenAvatar";

interface TokenSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken?: (token: Token) => void;
}

export function TokenSearchModal({ isOpen, onClose, onSelectToken }: TokenSearchModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [caSearching, setCaSearching] = useState(false);
  const [caToken, setCaToken] = useState<Token | null>(null);
  const [copiedMint, setCopiedMint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-load top tokens when modal is mounted/opened
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getTopTokens(150)
        .then((data) => {
          // Find or create COOK token
          const cookIdx = data.findIndex(
            (t) =>
              t.mint.toLowerCase() === COOK_MINT.toLowerCase() ||
              t.symbol.toUpperCase() === "COOK"
          );
          let cookToken = cookIdx >= 0 ? data[cookIdx] : NATIVE_COOK_TOKEN;
          cookToken = { ...cookToken, symbol: "COOK", logoUri: "/cook.jpeg" };
          const others = data.filter(
            (t) =>
              t.mint.toLowerCase() !== COOK_MINT.toLowerCase() &&
              t.symbol.toUpperCase() !== "COOK"
          );
          // COOK is always pinned as the primary token
          setTokens([cookToken, ...others]);
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setCaToken(null);
    }
  }, [isOpen]);

  // Handle direct CA lookup if query looks like a base58 Solana/Cookie public key
  useEffect(() => {
    const trimmed = query.trim();
    const isBase58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);

    if (isBase58Address) {
      // Check if already in local tokens list
      const existing = tokens.find(
        (t) => t.mint.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) {
        setCaToken(existing);
        return;
      }

      // Query on-chain DAS via RPC
      setCaSearching(true);
      getTokenByMint(trimmed)
        .then((res) => {
          setCaToken(res);
        })
        .finally(() => setCaSearching(false));
    } else {
      setCaToken(null);
      setCaSearching(false);
    }
  }, [query, tokens]);

  // Popular quick chips
  const popularTokens = useMemo(() => {
    const prioritySymbols = ["TRS", "bCOOK", "HAYGUMMY", "TRASHCOIN", "COOKHOUSE", "CINU", "BURNT"];
    return tokens.filter((t) => prioritySymbols.includes(t.symbol)).slice(0, 6);
  }, [tokens]);

  // Filtered tokens with strict COOK prioritization
  const filtered = useMemo(() => {
    const isCook = (t: Token) =>
      t.mint.toLowerCase() === COOK_MINT.toLowerCase() ||
      t.symbol.toUpperCase() === "COOK";

    if (!query.trim()) {
      const cook = tokens.find(isCook);
      const others = tokens.filter((t) => !isCook(t));
      return cook ? [cook, ...others.slice(0, 14)] : tokens.slice(0, 15);
    }

    const q = query.toLowerCase().trim();

    const matches = tokens.filter((t) => {
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.mint.toLowerCase().includes(q)
      );
    });

    return matches
      .sort((a, b) => {
        const aIsCook = isCook(a);
        const bIsCook = isCook(b);
        // COOK always ranks first if it matches
        if (aIsCook && !bIsCook) return -1;
        if (!aIsCook && bIsCook) return 1;

        // Exact symbol match
        const aExact = a.symbol.toLowerCase() === q;
        const bExact = b.symbol.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Symbol starts with query
        const aStart = a.symbol.toLowerCase().startsWith(q);
        const bStart = b.symbol.toLowerCase().startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;

        // Volume / Market cap tie-breaker
        return (b.volume24h ?? 0) - (a.volume24h ?? 0);
      })
      .slice(0, 20);
  }, [tokens, query]);

  // Combined selectable list for unified keyboard navigation
  const displayList = useMemo(() => {
    const list: Token[] = [];
    if (caToken && !caSearching) {
      list.push(caToken);
    }
    for (const t of filtered) {
      if (!caToken || t.mint.toLowerCase() !== caToken.mint.toLowerCase()) {
        list.push(t);
      }
    }
    return list;
  }, [caToken, caSearching, filtered]);

  const cookToken = useMemo(() => {
    return (
      tokens.find(
        (t) =>
          t.symbol.toUpperCase() === "COOK" ||
          t.mint.toLowerCase() === COOK_MINT.toLowerCase()
      ) || NATIVE_COOK_TOKEN
    );
  }, [tokens]);

  const showCookSpotlight = useMemo(() => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return "cook".includes(q) || "cookie".includes(q) || cookToken.mint.toLowerCase().includes(q);
  }, [query, cookToken]);

  const cookIndexInDisplayList = useMemo(() => {
    return displayList.findIndex(
      (t) =>
        t.mint.toLowerCase() === COOK_MINT.toLowerCase() ||
        t.symbol.toUpperCase() === "COOK"
    );
  }, [displayList]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset selected index when query or items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, displayList.length]);

  // Scroll active item into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  function handleSelect(mint: string) {
    onClose();
    if (onSelectToken) {
      const selectedToken =
        displayList.find((t) => t.mint.toLowerCase() === mint.toLowerCase()) || {
          mint,
          symbol: "TOKEN",
          name: "Unknown Token",
          decimals: 9,
        };
      onSelectToken(selectedToken);
    }
    router.push(`/token/${mint}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (displayList.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % displayList.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (displayList.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + displayList.length) % displayList.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (displayList.length > 0 && displayList[selectedIndex]) {
        handleSelect(displayList[selectedIndex].mint);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  async function handleCopy(e: React.MouseEvent, mint: string) {
    e.stopPropagation();
    await copyToClipboard(mint);
    setCopiedMint(mint);
    setTimeout(() => setCopiedMint(null), 1500);
  }

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6 pt-[12vh] sm:pt-[15vh] select-none overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative z-10 w-full max-w-xl squircle-lg bg-[#0E1015] border border-border overflow-hidden flex flex-col max-h-[75vh]"
          >

            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-[#0B0D13]">
              <img src="/logo.png" alt="GlassJar" className="w-5 h-5 object-contain flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tokens by name, symbol, or CA..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none font-medium"
              />
              {query ? (
                <button
                  onClick={() => setQuery("")}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-sm" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-text-muted bg-bg-elevated border border-border rounded">
                  ESC
                </kbd>
              )}
            </div>

            {/* Quick Popular Tokens Bar with COOK as Featured Native Asset */}
            <div className="flex items-center gap-1.5 px-5 py-2 bg-[#0E1015] border-b border-border/50 overflow-x-auto no-scrollbar select-none">
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mr-1 flex-shrink-0">
                Popular:
              </span>
              <button
                type="button"
                onClick={() => handleSelect(COOK_MINT)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-accent/15 border border-accent/35 text-accent hover:bg-accent hover:text-[#08090C] transition-all flex-shrink-0 cursor-pointer shadow-[0_0_12px_rgba(59,178,115,0.25)]"
              >
                <img src="/cook.jpeg" alt="COOK" className="w-3.5 h-3.5 rounded-full object-cover" />
                <span>COOK</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-accent/25 uppercase font-mono tracking-wide">
                  Native
                </span>
              </button>
              {popularTokens.map((qt) => (
                <button
                  key={qt.mint}
                  type="button"
                  onClick={() => handleSelect(qt.mint)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-bg-card border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors flex-shrink-0 cursor-pointer"
                >
                  <TokenAvatar symbol={qt.symbol} logoUri={qt.logoUri} size={14} />
                  <span>{qt.symbol}</span>
                </button>
              ))}
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/30 p-2">
              {/* If querying a direct Contract Address */}
              {caSearching && (
                <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin text-accent text-base" />
                  <span>Looking up contract address on Cookie Chain...</span>
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center text-xs text-text-muted space-y-2">
                  <i className="ri-loader-4-line animate-spin text-accent text-xl block mx-auto" />
                  <p>Loading verified tokens...</p>
                </div>
              ) : displayList.length === 0 && !caSearching ? (
                <div className="py-12 text-center text-xs text-text-muted space-y-2">
                  <div className="w-10 h-10 mx-auto relative opacity-30 mb-2">
                    <Image src="/logo.png" alt="GlassJar" fill className="object-contain" />
                  </div>
                  <p className="font-semibold text-text-secondary">No tokens found</p>
                  <p>Try searching by ticker, name, or paste a full contract address (CA).</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Featured Native Asset Spotlight: COOK */}
                  {showCookSpotlight && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between px-2 py-1 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                          Cookie Chain Native Gas & Currency
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">L1 Native Asset</span>
                      </div>

                      <div
                        ref={(el) => {
                          if (cookIndexInDisplayList >= 0) {
                            itemRefs.current[cookIndexInDisplayList] = el;
                          }
                        }}
                        onClick={() => handleSelect(cookToken.mint)}
                        onMouseEnter={() => {
                          if (cookIndexInDisplayList >= 0) setSelectedIndex(cookIndexInDisplayList);
                        }}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all duration-150 cursor-pointer group flex items-center justify-between gap-3",
                          selectedIndex === cookIndexInDisplayList
                            ? "bg-accent/15 border-accent shadow-[0_0_20px_rgba(59,178,115,0.22)] ring-1 ring-accent/40"
                            : "bg-white/[0.04] border-accent/30 hover:border-accent/60 hover:bg-white/[0.06]"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-full p-0.5 border border-accent/50 bg-accent/20 flex-shrink-0 shadow-[0_0_10px_rgba(59,178,115,0.25)]">
                            <img
                              src="/cook.jpeg"
                              alt="COOK"
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-extrabold text-base tracking-tight transition-colors truncate",
                                  selectedIndex === cookIndexInDisplayList
                                    ? "text-accent"
                                    : "text-text-primary group-hover:text-accent"
                                )}
                              >
                                COOK
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/20 text-accent font-bold uppercase tracking-wider flex items-center gap-1 border border-accent/40">
                                <span className="w-1 h-1 rounded-full bg-accent animate-pulse" />
                                Native Gas
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                              <span className="truncate">Cookie Chain Gas & Liquidity</span>
                              <span>•</span>
                              <span className="font-mono text-[11px]">{truncateAddress(cookToken.mint, 4)}</span>
                              <button
                                onClick={(e) => handleCopy(e, cookToken.mint)}
                                className="hover:text-accent transition-colors"
                                title="Copy Contract Address"
                              >
                                <i className={cn(copiedMint === cookToken.mint ? "ri-check-line text-accent" : "ri-file-copy-line")} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3.5 flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-bold text-text-primary tabular-nums font-mono">
                              {cookToken.price !== undefined ? formatPrice(cookToken.price) : "Native Gas"}
                            </p>
                            {cookToken.priceChange24h !== undefined && (
                              <p className={cn("text-xs font-semibold tabular-nums font-mono", deltaColorClass(cookToken.priceChange24h))}>
                                {formatPct(cookToken.priceChange24h)}
                              </p>
                            )}
                          </div>
                          <div
                            className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                              selectedIndex === cookIndexInDisplayList
                                ? "bg-accent text-[#08090C] shadow-[0_0_10px_rgba(59,178,115,0.4)]"
                                : "bg-bg-card border border-border text-text-muted group-hover:text-accent group-hover:border-accent/40"
                            )}
                          >
                            <i className="ri-arrow-right-line text-xs" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {caToken && !caSearching && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-accent px-2 pt-1 pb-0.5">
                      Direct Contract Address Match
                    </div>
                  )}

                  {!query.trim() && displayList.length > 1 && (
                    <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2 pt-2 pb-1">
                      Verified Market Tokens
                    </div>
                  )}

                  {displayList.map((t, idx) => {
                    // If COOK is already highlighted in the spotlight above, omit duplicate standard row
                    if (
                      showCookSpotlight &&
                      (t.mint.toLowerCase() === COOK_MINT.toLowerCase() ||
                        t.symbol.toUpperCase() === "COOK")
                    ) {
                      return null;
                    }

                    return (
                      <TokenResultRow
                        key={t.mint}
                        token={t}
                        isSelected={idx === selectedIndex}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        itemRef={(el) => {
                          itemRefs.current[idx] = el;
                        }}
                        onSelect={handleSelect}
                        onCopy={handleCopy}
                        isCopied={copiedMint === t.mint}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-2.5 bg-bg/70 border-t border-border/60 flex items-center justify-between text-[11px] text-text-muted select-none">
              <span>{displayList.length} tokens found</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-card border border-border text-[10px]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-card border border-border text-[10px]">↓</kbd>
                  <span className="hidden sm:inline">navigate</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-bg-card border border-border text-[10px]">↵</kbd>
                  <span>view token</span>
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

function TokenResultRow({
  token,
  onSelect,
  onCopy,
  isCopied,
  isSelected,
  onMouseEnter,
  itemRef,
}: {
  token: Token;
  onSelect: (mint: string) => void;
  onCopy: (e: React.MouseEvent, mint: string) => void;
  isCopied: boolean;
  isSelected?: boolean;
  onMouseEnter?: () => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}) {
  const changeClass = deltaColorClass(token.priceChange24h ?? 0);
  const isCook = token.symbol.toUpperCase() === "COOK" || token.mint === COOK_MINT;

  return (
    <div
      ref={itemRef}
      onClick={() => onSelect(token.mint)}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex items-center justify-between gap-3 p-3 rounded-xl transition-all duration-150 cursor-pointer group border",
        isSelected
          ? "bg-white/[0.08] border-accent/50 shadow-[0_0_16px_rgba(59,178,115,0.18)] ring-1 ring-accent/30"
          : "hover:bg-bg-elevated border-transparent"
      )}
    >
      {/* Left: Avatar & Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <TokenAvatar
          logoUri={token.logoUri}
          symbol={token.symbol}
          size={34}
          className="border border-border flex-shrink-0"
        />

        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-bold tracking-tight transition-colors truncate",
                isSelected ? "text-accent" : "text-text-primary group-hover:text-accent"
              )}
            >
              {token.symbol}
            </span>
            <span className="text-xs text-text-muted truncate hidden sm:inline">
              {token.name}
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

          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-mono">
            <span>{truncateAddress(token.mint, 4)}</span>
            <button
              onClick={(e) => onCopy(e, token.mint)}
              className="hover:text-accent transition-colors"
              title="Copy Contract Address"
            >
              <i className={cn(isCopied ? "ri-check-line text-accent" : "ri-file-copy-line")} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Pricing & Delta */}
      <div className="text-right flex items-center gap-4 flex-shrink-0">
        <div className="flex flex-col items-end">
          <p className="text-sm font-bold text-text-primary tabular-nums font-mono">
            {token.price !== undefined ? formatPrice(token.price) : "—"}
          </p>
          {token.priceChange24h !== undefined && (
            <p className={cn("text-xs font-semibold tabular-nums", changeClass)}>
              {formatPct(token.priceChange24h)}
            </p>
          )}
        </div>

        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            isSelected
              ? "bg-accent text-[#08090C] border border-accent shadow-[0_0_10px_rgba(59,178,115,0.4)]"
              : "bg-bg-card border border-border text-text-muted group-hover:text-accent group-hover:border-accent/40"
          )}
        >
          <i className="ri-arrow-right-line text-xs" />
        </div>
      </div>
    </div>
  );
}
