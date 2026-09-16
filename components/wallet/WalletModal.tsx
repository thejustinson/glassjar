"use client";

/**
 * components/wallet/WalletModal.tsx
 * Custom high-density wallet connection modal.
 * Uses React Portal to mount directly into document.body, ensuring
 * perfect vertical and horizontal centering regardless of parent stacking contexts.
 *
 * Prioritizes Nightly Wallet with uncompressed icons and non-wrapping badges.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { type WalletName, WalletReadyState } from "@solana/wallet-adapter-base";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Nightly brand constants
const NIGHTLY_DOWNLOAD_URL = "https://nightly.app/download";

const NIGHTLY_LOGO_IMG = (
  <img
    src="/nightly-logo.jpg"
    alt="Nightly Wallet"
    width={44}
    height={44}
    className="w-11 h-11 min-w-[44px] rounded-xl object-cover flex-shrink-0 shadow-md border border-accent/30"
  />
);

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const [mounted, setMounted] = useState(false);
  const { wallets, select, connecting } = useWallet();
  const [selectedWalletName, setSelectedWalletName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Separate Nightly from other wallets
  const nightlyWallet = wallets.find((w) =>
    w.adapter.name.toLowerCase().includes("nightly")
  );

  const otherWallets = wallets.filter(
    (w) => !w.adapter.name.toLowerCase().includes("nightly")
  );

  const isNightlyInstalled =
    nightlyWallet?.readyState === WalletReadyState.Installed ||
    nightlyWallet?.readyState === WalletReadyState.Loadable;

  async function handleSelect(name: WalletName) {
    try {
      setErrorMsg(null);
      setSelectedWalletName(name);
      select(name);
      setTimeout(() => {
        onClose();
        setSelectedWalletName(null);
      }, 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect wallet");
      setSelectedWalletName(null);
    }
  }

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none overflow-y-auto">
          {/* Backdrop blur covering entire viewport */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container — Dead-Centered with comfortable width */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 450, damping: 32 }}
            className="relative z-10 w-full max-w-[490px] my-auto rounded-2xl bg-[#0E1015] border border-border shadow-2xl shadow-black overflow-hidden"
          >
            {/* Ambient emerald backlight inside modal */}
            <div
              className="pointer-events-none absolute -top-24 -right-24 w-52 h-52 rounded-full opacity-25 blur-3xl"
              style={{ background: "radial-gradient(circle, #3BB273 0%, transparent 70%)" }}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/60">
              <div>
                <h3 className="text-base font-bold text-text-primary tracking-wide flex items-center gap-2">
                  <i className="ri-wallet-3-line text-accent text-lg" />
                  Connect Wallet
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Select a wallet to trade on Cookie Chain
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                title="Close"
              >
                <i className="ri-close-line text-lg" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-xs text-error flex items-center gap-2">
                  <i className="ri-error-warning-line text-sm flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* ─── FEATURED PRIMARY: NIGHTLY WALLET ─── */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  <span>Primary Wallet</span>
                  <span className="text-accent flex items-center gap-1.5 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    Cookie Chain Recommended
                  </span>
                </div>

                {isNightlyInstalled && nightlyWallet ? (
                  /* Installed: Connect Directly */
                  <button
                    onClick={() => handleSelect(nightlyWallet.adapter.name)}
                    disabled={connecting}
                    className={cn(
                      "w-full p-4 rounded-xl text-left border transition-all duration-200",
                      "bg-gradient-to-r from-accent/10 via-bg-elevated to-bg-elevated",
                      "border-accent/40 hover:border-accent hover:shadow-[0_0_20px_rgba(59,178,115,0.25)]",
                      "flex items-center justify-between gap-3 group",
                      selectedWalletName === nightlyWallet.adapter.name && "border-accent bg-accent/20"
                    )}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {NIGHTLY_LOGO_IMG}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors whitespace-nowrap">
                            Nightly Wallet
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent whitespace-nowrap flex-shrink-0">
                            Installed
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          Native support for Cookie Chain SVM
                        </p>
                      </div>
                    </div>

                    <div className="w-8 h-8 min-w-[32px] rounded-full bg-accent text-[#08090C] flex items-center justify-center font-bold text-sm shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
                      {connecting && selectedWalletName === nightlyWallet.adapter.name ? (
                        <i className="ri-loader-4-line animate-spin" />
                      ) : (
                        <i className="ri-arrow-right-line" />
                      )}
                    </div>
                  </button>
                ) : (
                  /* Not Detected: Clean Unsquished Install Card */
                  <div className="p-4 rounded-xl border border-accent/30 bg-gradient-to-r from-accent/10 via-bg-elevated to-bg-elevated flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {NIGHTLY_LOGO_IMG}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-text-primary whitespace-nowrap">
                            Nightly Wallet
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/20 text-warning whitespace-nowrap flex-shrink-0">
                            Not Installed
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 truncate">
                          Official wallet for Cookie Chain
                        </p>
                      </div>
                    </div>

                    <a
                      href={NIGHTLY_DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-4 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_14px_rgba(59,178,115,0.35)] transition-all flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap select-none"
                    >
                      <span>Get Nightly</span>
                      <i className="ri-external-link-line text-xs" />
                    </a>
                  </div>
                )}
              </div>

              {/* ─── OTHER WALLETS ─── */}
              {otherWallets.length > 0 && (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    Other Wallets
                  </p>

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {otherWallets.map((w) => {
                      const isInstalled =
                        w.readyState === WalletReadyState.Installed ||
                        w.readyState === WalletReadyState.Loadable;

                      return (
                        <button
                          key={w.adapter.name}
                          onClick={() => handleSelect(w.adapter.name)}
                          disabled={connecting}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border border-border bg-bg-elevated/50",
                            "hover:bg-bg-elevated hover:border-border/80 transition-all duration-150",
                            "flex items-center justify-between group text-left",
                            selectedWalletName === w.adapter.name && "border-accent bg-accent/10"
                          )}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {w.adapter.icon ? (
                              <img
                                src={w.adapter.icon}
                                alt={w.adapter.name}
                                className="w-7 h-7 min-w-[28px] rounded-lg object-contain flex-shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="w-7 h-7 min-w-[28px] rounded-lg bg-bg-card border border-border flex items-center justify-center text-text-muted flex-shrink-0">
                                <i className="ri-wallet-line text-xs" />
                              </div>
                            )}
                            <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors whitespace-nowrap truncate">
                              {w.adapter.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isInstalled ? (
                              <span className="text-[10px] text-text-muted font-medium whitespace-nowrap">
                                Detected
                              </span>
                            ) : (
                              <span className="text-[10px] text-text-muted/60 whitespace-nowrap">
                                Not detected
                              </span>
                            )}
                            <i className="ri-arrow-right-s-line text-text-muted group-hover:text-text-primary transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Security notice / footer note */}
              <div className="pt-2 border-t border-border/50 text-center">
                <p className="text-[11px] text-text-muted leading-relaxed">
                  Cookie Chain is an independent SVM cluster.
                  <br />
                  Signing transactions never exposes your private keys.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
