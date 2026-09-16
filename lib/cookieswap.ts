/**
 * lib/cookieswap.ts
 * Cookiebox aggregator quote + swap transaction builder.
 *
 * Confirmed endpoints (from cookie-mcp source, MIT licensed):
 *
 *   Primary aggregator (DEFAULT):
 *     GET  https://agg.cookiebox.app/quote?inputMint=&outputMint=&amount=&slippageBps=&owner=
 *
 *   Fallback (CookieScan swap API):
 *     GET  https://swap.cookiescan.io/api/quote/multi-route?inputMint=&outputMint=&amount=&slippageBps=
 *     POST https://swap.cookiescan.io/api/swap-tx/multi-route   { multiRoute, userPublicKey }
 *
 * Fee structure (confirmed from cookie-mcp source):
 *   Default slippage: 500 bps (5%)
 *   Protocol fee: ~20 bps
 *   Pool trade fee: ~1% on CPAMM pools
 */

import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

const COOKIEBOX_AGG_URL =
  process.env.NEXT_PUBLIC_COOKIEBOX_AGG_URL?.trim().replace(/\/$/, "") ??
  "https://agg.cookiebox.app";

const COOKIE_SWAP_API_URL =
  process.env.NEXT_PUBLIC_COOKIE_SWAP_API_URL?.trim().replace(/\/$/, "") ??
  "https://swap.cookiescan.io/api";

export const DEFAULT_SLIPPAGE_BPS = 500; // 5%

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  /** In base units (e.g. lamports-equivalent) */
  inAmount: string;
  /** In base units */
  outAmount: string;
  /** In base units, worst-case after slippage */
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: number;
  /** USD fee estimate */
  feeUsd?: number;
  route?: unknown;   // raw route object, passed back to buildSwapTx
  _source: "cookiebox" | "cookiescan";
}

export interface SwapTxResult {
  /** Base64-encoded serialized transaction */
  transaction: string;
  /** "versioned" | "legacy" */
  txType?: string;
  lastValidBlockHeight?: number;
}

// ─── Quote ───────────────────────────────────────────────────────────────────

/**
 * Fetch a swap quote from the Cookiebox aggregator.
 * Falls back to the CookieScan swap API if Cookiebox is unavailable.
 *
 * @param inputMint   Source token mint address
 * @param outputMint  Destination token mint address
 * @param amount      Input amount in base units (string to avoid precision loss)
 * @param slippageBps Slippage tolerance in basis points (default 500 = 5%)
 * @param owner       Optional: wallet public key (improves routing)
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  owner?: string
): Promise<SwapQuote> {
  // Try Cookiebox aggregator first
  try {
    return await quoteViaCookiebox(inputMint, outputMint, amount, slippageBps, owner);
  } catch (primaryErr) {
    // Fall back to CookieScan swap API
    try {
      return await quoteViaCookieScan(inputMint, outputMint, amount, slippageBps);
    } catch (fallbackErr) {
      // Both failed — surface the primary error
      throw new Error(
        `Swap quote unavailable: ${primaryErr instanceof Error ? primaryErr.message : String(primaryErr)}`
      );
    }
  }
}

async function quoteViaCookiebox(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number,
  owner?: string
): Promise<SwapQuote> {
  const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });
  if (owner) params.set("owner", owner);

  const res = await fetch(`${COOKIEBOX_AGG_URL}/quote?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    if (text.includes("no route") || text.includes("not found")) {
      throw new Error("No swap route available for this pair");
    }
    throw new Error(`Cookiebox quote error ${res.status}: ${text}`);
  }

  const body = await res.json() as {
    route?: {
      inAmount?: string;
      outAmount?: string;
      otherAmountThreshold?: string;
      priceImpactPct?: number;
      slippageBps?: number;
    };
    error?: string;
  };

  if (body.error) throw new Error(`Cookiebox: ${body.error}`);
  if (!body.route) throw new Error("Cookiebox returned no route");

  const route = body.route;
  return {
    inputMint,
    outputMint,
    inAmount:              route.inAmount ?? amount,
    outAmount:             route.outAmount ?? "0",
    otherAmountThreshold:  route.otherAmountThreshold ?? "0",
    slippageBps:           route.slippageBps ?? slippageBps,
    priceImpactPct:        route.priceImpactPct ?? 0,
    route:                 body.route,
    _source:               "cookiebox",
  };
}

async function quoteViaCookieScan(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number
): Promise<SwapQuote> {
  const params = new URLSearchParams({ inputMint, outputMint, amount, slippageBps: String(slippageBps) });

  const res = await fetch(`${COOKIE_SWAP_API_URL}/quote/multi-route?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`CookieScan quote error ${res.status}: ${await res.text()}`);
  }

  const body = await res.json() as {
    inAmount?: string;
    outAmount?: string;
    otherAmountThreshold?: string;
    priceImpactPct?: number;
    slippageBps?: number;
  };

  return {
    inputMint,
    outputMint,
    inAmount:              body.inAmount ?? amount,
    outAmount:             body.outAmount ?? "0",
    otherAmountThreshold:  body.otherAmountThreshold ?? "0",
    slippageBps:           body.slippageBps ?? slippageBps,
    priceImpactPct:        body.priceImpactPct ?? 0,
    route:                 body,
    _source:               "cookiescan",
  };
}

// ─── Transaction Builder ──────────────────────────────────────────────────────

/**
 * Build a swap transaction from a quote.
 * Returns a serialized transaction ready to be signed by the wallet.
 *
 * @param quote         The quote returned by getSwapQuote
 * @param userPublicKey The user's wallet public key (base58)
 */
export async function buildSwapTransaction(
  quote: SwapQuote,
  userPublicKey: string
): Promise<VersionedTransaction | Transaction> {
  const swapTxResult = await fetchSwapTx(quote, userPublicKey);
  return deserializeTransaction(swapTxResult.transaction);
}

async function fetchSwapTx(
  quote: SwapQuote,
  userPublicKey: string
): Promise<SwapTxResult> {
  const res = await fetch(`${COOKIE_SWAP_API_URL}/swap-tx/multi-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiRoute: quote.route, userPublicKey }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Swap tx build error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<SwapTxResult>;
}

function deserializeTransaction(
  base64Tx: string
): VersionedTransaction | Transaction {
  const bytes = Buffer.from(base64Tx, "base64");
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    // Fall back to legacy transaction
    return Transaction.from(bytes);
  }
}

// ─── Simulation ──────────────────────────────────────────────────────────────

/**
 * Simulate the swap transaction before asking the user to sign.
 * Surfaces simulation errors early so we don't waste a signature request.
 */
export async function simulateSwap(
  connection: Connection,
  tx: VersionedTransaction | Transaction,
  signerKey: PublicKey
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (tx instanceof VersionedTransaction) {
      const result = await connection.simulateTransaction(tx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
      if (result.value.err) {
        return {
          ok: false,
          error: JSON.stringify(result.value.err),
        };
      }
    } else {
      const result = await connection.simulateTransaction(tx, []);
      if (result.value.err) {
        return {
          ok: false,
          error: JSON.stringify(result.value.err),
        };
      }
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Price Impact ─────────────────────────────────────────────────────────────

/** Classify price impact severity for UI warning display. */
export function priceImpactSeverity(
  pct: number
): "low" | "medium" | "high" | "very-high" {
  if (pct < 1)  return "low";
  if (pct < 3)  return "medium";
  if (pct < 5)  return "high";
  return "very-high";
}
