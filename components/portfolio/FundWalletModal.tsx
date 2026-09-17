"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { copyToClipboard, explorerAddressUrl, truncateAddress } from "@/lib";
import { cn } from "@/lib/utils";

interface FundWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

export function FundWalletModal({
  isOpen,
  onClose,
  walletAddress,
}: FundWalletModalProps) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    QRCode.toDataURL(walletAddress, {
      width: 220,
      margin: 2,
      color: {
        dark: "#08090C",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((err) => console.error("Failed to generate QR code:", err));
  }, [walletAddress]);

  async function handleCopy() {
    await copyToClipboard(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-3xl bg-[#0E1015] border border-border shadow-2xl p-6 sm:p-7 overflow-hidden text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle decorative background glow */}
        <div className="absolute -top-20 -right-20 w-56 h-56 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Top Header Bar */}
        <div className="flex items-center justify-between pb-5 border-b border-border/70 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent flex-shrink-0">
              <i className="ri-qr-code-line text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-text-primary">Receive & Fund Wallet</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-[10px] font-bold text-accent">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  <span>Cookie Chain</span>
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Scan or share this address to receive funds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-card border border-border text-text-muted hover:text-text-primary hover:bg-bg-elevated flex items-center justify-center transition-colors cursor-pointer"
            title="Close modal"
          >
            <i className="ri-close-line text-lg" />
          </button>
        </div>

        {/* 2-Column Horizontally Aligned Body */}
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6 items-center">
          {/* Left Column: QR Code Card */}
          <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg-card border border-border text-center">
            <div className="p-2.5 bg-white rounded-xl shadow-md">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Wallet QR Code"
                  className="w-40 h-40 rounded-lg block"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-xs text-black/50">
                  <i className="ri-refresh-line animate-spin text-2xl text-accent" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-text-muted mt-2 font-medium flex items-center gap-1">
              <i className="ri-camera-line text-xs" />
              <span>Scan with SVM wallet</span>
            </span>
          </div>

          {/* Right Column: Address, Copy, and Actions */}
          <div className="space-y-4">
            {/* Wallet Address Container */}
            <div className="p-3.5 rounded-2xl bg-bg-card border border-border">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted">
                  Your Address
                </span>
                <span className="text-[10px] text-accent font-semibold">
                  Cookie Chain Native
                </span>
              </div>
              <p className="text-xs font-mono text-text-primary break-all leading-relaxed bg-bg-elevated/60 p-2 rounded-lg border border-border/50">
                {walletAddress}
              </p>
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className={cn(
                  "h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer",
                  copied
                    ? "bg-accent text-[#08090C] shadow-[0_0_12px_rgba(59,178,115,0.4)]"
                    : "bg-accent text-[#08090C] hover:bg-[#45c381] shadow-[0_0_10px_rgba(59,178,115,0.25)]"
                )}
              >
                <i className={cn("text-sm", copied ? "ri-check-line font-bold" : "ri-file-copy-line")} />
                <span>{copied ? "Copied to Clipboard!" : "Copy Address"}</span>
              </button>

              {/* View on Explorer */}
              <a
                href={explorerAddressUrl(walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3 rounded-xl bg-bg-elevated border border-border text-text-secondary hover:text-text-primary hover:border-accent/40 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <span>Cookiescan</span>
                <i className="ri-external-link-line text-xs" />
              </a>
            </div>

            {/* Bridge Notice & Link */}
            <div className="p-3 rounded-xl bg-bg-elevated/40 border border-border/70 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="text-[11px] text-text-secondary font-medium">
                  Need to move funds from Solana?
                </p>
                <p className="text-[10px] text-text-muted">
                  Bridge native COOK 1:1 via Hyperlane warp route
                </p>
              </div>
              <Link
                href="/bridge"
                onClick={onClose}
                className="h-8 px-3 rounded-lg bg-accent/15 border border-accent/30 text-accent hover:bg-accent hover:text-[#08090C] text-[11px] font-bold transition-all flex items-center gap-1 flex-shrink-0"
              >
                <span>Bridge</span>
                <i className="ri-arrow-right-line text-xs" />
              </Link>
            </div>
          </div>
        </div>

        {/* Footer info note */}
        <p className="text-[10px] text-text-muted mt-5 pt-3 border-t border-border/50 text-center leading-relaxed">
          Send only native <strong>COOK</strong> or Cookie Chain SPL tokens to this address. Sending unsupported tokens may result in permanent loss.
        </p>
      </div>
    </div>
  );
}
