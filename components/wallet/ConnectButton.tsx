"use client";

/**
 * components/wallet/ConnectButton.tsx
 * Custom wallet connect button using GlassJar design tokens and our custom WalletModal.
 * Prioritizes Nightly Wallet and avoids default generic wallet-adapter-react-ui popups.
 */

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { truncateAddress, copyToClipboard } from "@/lib";
import { cn } from "@/lib/utils";
import { WalletModal } from "./WalletModal";
import { recordWalletConnection } from "@/lib/supabase";

export function ConnectButton({ className }: { className?: string }) {
  const { publicKey, wallet, disconnect, connecting, connected } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const address = publicKey?.toBase58() ?? "";
  const truncated = address ? truncateAddress(address) : "";

  // Record connection to Supabase
  useEffect(() => {
    if (connected && address) {
      recordWalletConnection(address, wallet?.adapter?.name);
    }
  }, [connected, address, wallet?.adapter?.name]);

  async function handleCopy() {
    await copyToClipboard(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  }

  return (
    <>
      {/* Not Connected State */}
      {!connected && !connecting && (
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          onClick={() => setModalOpen(true)}
          className={cn(
            "h-9 px-5 rounded-full text-xs font-bold tracking-wider uppercase",
            "bg-accent text-[#08090C] border border-accent",
            "shadow-[0_0_16px_rgba(59,178,115,0.35)] hover:shadow-[0_0_24px_rgba(59,178,115,0.6)]",
            "hover:bg-[#45c381] active:bg-accent-muted",
            "transition-all duration-200 inline-flex items-center gap-2 select-none",
            className
          )}
        >
          <i className="ri-wallet-3-line text-[14px]" />
          Connect Wallet
        </motion.button>
      )}

      {/* Connecting Spinner State */}
      {connecting && (
        <div
          className={cn(
            "h-9 px-4 rounded-full text-xs font-medium",
            "bg-bg-card text-text-muted border border-border",
            "inline-flex items-center gap-2",
            className
          )}
        >
          <svg className="animate-spin w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray="31.4"
              strokeDashoffset="10"
              opacity="0.3"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          Connecting…
        </div>
      )}

      {/* Connected State with Address & Dropdown */}
      {connected && (
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            onClick={() => setShowMenu((v) => !v)}
            className={cn(
              "h-9 px-3.5 rounded-full text-xs font-medium",
              "bg-bg-card text-text-primary border border-border",
              "hover:border-accent hover:text-accent shadow-sm",
              "transition-colors duration-150 inline-flex items-center gap-2",
              className
            )}
          >
            <span className="w-2 h-2 rounded-full bg-success flex-shrink-0 animate-pulse" />
            <span className="font-mono text-xs tabular-nums">{truncated}</span>
            <i
              className={cn(
                "ri-arrow-down-s-line text-[14px] transition-transform duration-200",
                showMenu && "rotate-180"
              )}
            />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <>
                {/* Click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  className={cn(
                    "absolute right-0 top-full mt-1.5 z-50 min-w-[210px]",
                    "bg-bg-card border border-border rounded-xl",
                    "shadow-2xl shadow-black/80 py-1.5 overflow-hidden backdrop-blur-xl"
                  )}
                >
                  {/* Full address display */}
                  <div className="px-3.5 py-2 text-xs text-text-muted border-b border-border/50">
                    <p className="font-mono break-all leading-relaxed">{address}</p>
                  </div>

                  <button
                    onClick={handleCopy}
                    className="w-full px-3.5 py-2 text-xs text-text-primary hover:bg-bg-elevated hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <i
                      className={cn(
                        "text-[14px]",
                        copied ? "ri-check-line text-success" : "ri-file-copy-line text-text-muted"
                      )}
                    />
                    <span>{copied ? "Copied!" : "Copy address"}</span>
                  </button>

                  <a
                    href={`https://cookiescan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setShowMenu(false)}
                    className="w-full px-3.5 py-2 text-xs text-text-primary hover:bg-bg-elevated hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <i className="ri-external-link-line text-[14px] text-text-muted" />
                    <span>View on CookieScan</span>
                  </a>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-xs text-text-primary hover:bg-bg-elevated transition-colors flex items-center gap-2"
                  >
                    <i className="ri-arrow-left-right-line text-[14px] text-text-muted" />
                    <span>Change Wallet</span>
                  </button>

                  <div className="border-t border-border/50 mt-1 pt-1">
                    <button
                      onClick={() => {
                        disconnect();
                        setShowMenu(false);
                      }}
                      className="w-full px-3.5 py-2 text-xs text-error hover:bg-error/10 transition-colors flex items-center gap-2"
                    >
                      <i className="ri-logout-box-r-line text-[14px]" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Custom Modal with Nightly Priority */}
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
