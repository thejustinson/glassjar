"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { type WatchlistItem } from "@/lib/watchlist";
import { TokenAvatar } from "@/components/ui/TokenAvatar";
import { formatPrice } from "@/lib/format";

interface WatchlistEditModalProps {
  item: WatchlistItem | null;
  currentPrice?: number;
  onClose: () => void;
  onSave: (mint: string, updates: Partial<WatchlistItem>) => void;
}

export function WatchlistEditModal({
  item,
  currentPrice,
  onClose,
  onSave,
}: WatchlistEditModalProps) {
  const [targetPrice, setTargetPrice] = useState<string>(
    item?.targetPrice ? item.targetPrice.toString() : ""
  );
  const [notes, setNotes] = useState<string>(item?.notes || "");
  const [trackedAmount, setTrackedAmount] = useState<string>(
    item?.trackedAmount ? item.trackedAmount.toString() : ""
  );

  if (!item) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    const numTarget = targetPrice ? parseFloat(targetPrice) : undefined;
    const numTracked = trackedAmount ? parseFloat(trackedAmount) : undefined;

    onSave(item.mint, {
      targetPrice: numTarget && !isNaN(numTarget) ? numTarget : undefined,
      trackedAmount: numTracked && !isNaN(numTracked) ? numTracked : undefined,
      notes: notes.trim() || undefined,
    });
    onClose();
  }

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 450, damping: 32 }}
          className="relative z-10 w-full max-w-md squircle-lg glass-panel border border-white/10 shadow-2xl p-6 space-y-5 overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-36 h-36 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="squircle-sm p-1 bg-white/[0.04] border border-white/10 shadow-md">
                <TokenAvatar
                  logoUri={item.logoUri}
                  symbol={item.symbol}
                  size={36}
                  className="squircle-xs"
                />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <span>{item.symbol}</span>
                  <span className="text-xs font-normal text-text-muted">({item.name})</span>
                </h3>
                <p className="text-[11px] font-mono text-text-muted">
                  Added at: {item.addedPrice > 0 ? formatPrice(item.addedPrice) : "—"}
                  {currentPrice !== undefined && ` • Current: ${formatPrice(currentPrice)}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full glass-pill border border-white/10 flex items-center justify-center text-text-muted hover:text-text-primary hover:border-white/20 transition-colors cursor-pointer"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {/* Target Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Target Price (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-text-muted">
                  $
                </span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 0.045"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors"
                />
              </div>
            </div>

            {/* Tracked Position Amount (Paper Trading / Offline Portfolio) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Tracked Quantity
                </label>
                <span className="text-[10px] text-text-muted">For paper PnL calculation</span>
              </div>
              <input
                type="number"
                step="any"
                placeholder="e.g. 5000"
                value={trackedAmount}
                onChange={(e) => setTrackedAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Strategy & Notes
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Watching for DEX volume surge after graduation; exit target 2x."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/60 transition-colors resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full glass-pill border border-white/10 text-xs font-semibold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-full bg-accent text-[#08090C] text-xs font-bold hover:bg-[#45c381] transition-all shadow-[0_0_14px_rgba(59,178,115,0.3)] cursor-pointer"
              >
                Save Tracking Info
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
