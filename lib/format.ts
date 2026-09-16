/**
 * lib/format.ts
 * Display formatting utilities — amounts, addresses, numbers, dates.
 * Always convert from base units here at the render layer, never earlier.
 */

import { NATIVE_MINT_DECIMALS } from "./chain";

// ─── Address ────────────────────────────────────────────────────────────────

/**
 * Truncates a public key to the standard `XXXX…XXXX` format.
 * @param address   Full base58 address
 * @param chars     Number of chars to keep on each side (default 4)
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

// ─── Amounts ────────────────────────────────────────────────────────────────

/**
 * Converts a raw on-chain amount (BigInt or number in base units)
 * to a human-readable decimal string.
 *
 * @param raw       Base-unit amount (e.g. lamports)
 * @param decimals  Token decimals (default: COOK = 9)
 * @param dp        Display decimal places (default: 4)
 */
export function fromBaseUnits(
  raw: bigint | number | string,
  decimals: number = NATIVE_MINT_DECIMALS,
  dp = 4
): string {
  const value = Number(raw) / 10 ** decimals;
  return formatNumber(value, dp);
}

/**
 * Converts a human-readable amount to base units (BigInt).
 */
export function toBaseUnits(amount: string | number, decimals: number): bigint {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return BigInt(0);
  return BigInt(Math.round(num * 10 ** decimals));
}

// ─── Number Formatting ──────────────────────────────────────────────────────

/**
 * Formats a number with commas and fixed decimal places.
 * Falls back to compact notation for very large numbers.
 */
export function formatNumber(
  value: number,
  dp = 2,
  { compact = false }: { compact?: boolean } = {}
): string {
  if (!isFinite(value)) return "—";
  if (compact || Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

/**
 * Formats a USD value.
 * Uses compact notation above $1M.
 */
export function formatUsd(value: number, dp = 2): string {
  if (!isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return `$${formatNumber(value, 2, { compact: true })}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

/**
 * Formats a price — uses more decimal places for sub-cent assets.
 */
export function formatPrice(value: number): string {
  if (!isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.000001) return `$${value.toExponential(2)}`;
  if (value < 0.001) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return formatUsd(value, 2);
}

/**
 * Formats a percentage change.
 * Positive values get a + prefix, negative get a - (already in the number).
 */
export function formatPct(value: number, dp = 2): string {
  if (!isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(dp)}%`;
}

/**
 * Returns the Tailwind color class for a delta value (price change, PnL).
 */
export function deltaColorClass(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-error";
  return "text-text-muted";
}

// ─── Date / Time ────────────────────────────────────────────────────────────

export function formatTimestamp(unix: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(unix * 1000));
}

export function timeAgo(unix: number): string {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
