/**
 * lib/watchlist.ts
 * Per-wallet watchlist management with since-watched price tracking and lightweight PnL.
 *
 * Persists per-wallet in localStorage with cross-tab/cross-component reactive syncing.
 * Gracefully integrates with Supabase if configured.
 */

import { useState, useEffect, useCallback } from "react";
import {
  fetchWalletWatchlist,
  upsertWatchlistDbItem,
  removeWatchlistDbItem,
} from "./supabase";

export interface WatchlistItem {
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
  logoUri?: string | null;
  addedPrice: number;       // USD price when the token was added to the watchlist
  addedAt: number;          // Timestamp in ms
  targetPrice?: number;     // Optional user-defined target price
  notes?: string;           // Optional notes / trade strategy
  trackedAmount?: number;   // Optional manual holding/paper position amount
}

const STORAGE_PREFIX = "glassjar_watchlist_";
const WATCHLIST_EVENT = "glassjar:watchlist-updated";

function getStorageKey(walletAddress?: string | null): string {
  if (!walletAddress) return `${STORAGE_PREFIX}guest`;
  return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
}

/**
 * Reads the raw watchlist array for a given wallet (or guest) from localStorage.
 */
export function getWatchlist(walletAddress?: string | null): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getStorageKey(walletAddress);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // If wallet is connected but has empty list, check if guest has items to migrate/offer
      if (walletAddress) {
        const guestRaw = localStorage.getItem(`${STORAGE_PREFIX}guest`);
        if (guestRaw) {
          const guestItems: WatchlistItem[] = JSON.parse(guestRaw);
          if (Array.isArray(guestItems) && guestItems.length > 0) {
            localStorage.setItem(key, guestRaw);
            return guestItems;
          }
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves the watchlist array for a given wallet to localStorage and emits an update event.
 */
export function saveWatchlist(items: WatchlistItem[], walletAddress?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = getStorageKey(walletAddress);
    localStorage.setItem(key, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT, { detail: { walletAddress, items } }));
  } catch (err) {
    console.error("Failed to save watchlist:", err);
  }
}

/**
 * Check if a token mint is in the watchlist.
 */
export function isTokenWatched(mint: string, walletAddress?: string | null): boolean {
  const items = getWatchlist(walletAddress);
  return items.some((i) => i.mint.toLowerCase() === mint.toLowerCase());
}

/**
 * Add a token to the watchlist.
 */
export function addToWatchlist(
  token: {
    mint: string;
    symbol: string;
    name: string;
    decimals?: number;
    logoUri?: string | null;
    price?: number;
  },
  walletAddress?: string | null,
  options?: { notes?: string; targetPrice?: number; trackedAmount?: number }
): boolean {
  const items = getWatchlist(walletAddress);
  const existingIndex = items.findIndex((i) => i.mint.toLowerCase() === token.mint.toLowerCase());

  const addedPrice = typeof token.price === "number" && token.price > 0 ? token.price : 0;

  if (existingIndex >= 0) {
    // Already in watchlist, update fields if provided
    items[existingIndex] = {
      ...items[existingIndex],
      notes: options?.notes ?? items[existingIndex].notes,
      targetPrice: options?.targetPrice ?? items[existingIndex].targetPrice,
      trackedAmount: options?.trackedAmount ?? items[existingIndex].trackedAmount,
    };
    saveWatchlist(items, walletAddress);
    if (walletAddress) {
      upsertWatchlistDbItem(items[existingIndex], walletAddress);
    }
    return false;
  }

  const newItem: WatchlistItem = {
    mint: token.mint,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    logoUri: token.logoUri,
    addedPrice,
    addedAt: Date.now(),
    notes: options?.notes,
    targetPrice: options?.targetPrice,
    trackedAmount: options?.trackedAmount,
  };

  saveWatchlist([newItem, ...items], walletAddress);
  if (walletAddress) {
    upsertWatchlistDbItem(newItem, walletAddress);
  }
  return true;
}

/**
 * Remove a token from the watchlist.
 */
export function removeFromWatchlist(mint: string, walletAddress?: string | null): boolean {
  const items = getWatchlist(walletAddress);
  const filtered = items.filter((i) => i.mint.toLowerCase() !== mint.toLowerCase());
  if (filtered.length !== items.length) {
    saveWatchlist(filtered, walletAddress);
    if (walletAddress) {
      removeWatchlistDbItem(mint, walletAddress);
    }
    return true;
  }
  return false;
}

/**
 * Update an existing watchlist item (e.g. notes, targetPrice, trackedAmount).
 */
export function updateWatchlistItem(
  mint: string,
  updates: Partial<WatchlistItem>,
  walletAddress?: string | null
): void {
  const items = getWatchlist(walletAddress);
  const index = items.findIndex((i) => i.mint.toLowerCase() === mint.toLowerCase());
  if (index >= 0) {
    items[index] = { ...items[index], ...updates };
    saveWatchlist(items, walletAddress);
    if (walletAddress) {
      upsertWatchlistDbItem(items[index], walletAddress);
    }
  }
}

/**
 * React hook to interact with the watchlist reactive state.
 */
export function useWatchlist(walletAddress?: string | null) {
  const [items, setItems] = useState<WatchlistItem[]>(() => getWatchlist(walletAddress));

  const refresh = useCallback(() => {
    setItems(getWatchlist(walletAddress));
  }, [walletAddress]);

  useEffect(() => {
    refresh();

    function handleEvent(e: Event) {
      const custom = e as CustomEvent;
      if (!custom.detail || custom.detail.walletAddress === walletAddress || !walletAddress) {
        refresh();
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key && e.key.startsWith(STORAGE_PREFIX)) {
        refresh();
      }
    }

    window.addEventListener(WATCHLIST_EVENT, handleEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(WATCHLIST_EVENT, handleEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, [walletAddress, refresh]);

  // Cloud sync with Supabase when wallet connects
  useEffect(() => {
    if (!walletAddress) return;
    let active = true;

    fetchWalletWatchlist(walletAddress).then((remote) => {
      if (!active) return;
      if (remote.length > 0) {
        saveWatchlist(remote, walletAddress);
        setItems(remote);
      } else {
        // If Supabase has no records yet for this wallet, push any existing local items
        const local = getWatchlist(walletAddress);
        if (local.length > 0) {
          local.forEach((item) => {
            upsertWatchlistDbItem(item, walletAddress);
          });
        }
      }
    });

    return () => {
      active = false;
    };
  }, [walletAddress]);

  const add = useCallback(
    (
      token: {
        mint: string;
        symbol: string;
        name: string;
        decimals?: number;
        logoUri?: string | null;
        price?: number;
      },
      options?: { notes?: string; targetPrice?: number; trackedAmount?: number }
    ) => {
      const added = addToWatchlist(token, walletAddress, options);
      refresh();
      return added;
    },
    [walletAddress, refresh]
  );

  const remove = useCallback(
    (mint: string) => {
      const removed = removeFromWatchlist(mint, walletAddress);
      refresh();
      return removed;
    },
    [walletAddress, refresh]
  );

  const toggle = useCallback(
    (
      token: {
        mint: string;
        symbol: string;
        name: string;
        decimals?: number;
        logoUri?: string | null;
        price?: number;
      },
      options?: { notes?: string; targetPrice?: number; trackedAmount?: number }
    ) => {
      if (isTokenWatched(token.mint, walletAddress)) {
        remove(token.mint);
        return false;
      } else {
        add(token, options);
        return true;
      }
    },
    [walletAddress, add, remove]
  );

  const isWatched = useCallback(
    (mint: string) => {
      return items.some((i) => i.mint.toLowerCase() === mint.toLowerCase());
    },
    [items]
  );

  const update = useCallback(
    (mint: string, updates: Partial<WatchlistItem>) => {
      updateWatchlistItem(mint, updates, walletAddress);
      refresh();
    },
    [walletAddress, refresh]
  );

  return {
    items,
    count: items.length,
    isWatched,
    add,
    remove,
    toggle,
    update,
    refresh,
  };
}
