/**
 * lib/cookieswap.ts
 * Cookie Chain Swap quote and transaction builder.
 * Proxies through /api/swap/quote and /api/swap/build-tx to avoid CORS blocks
 * and guarantee reliable transaction assembly.
 */

import {
  Connection,
  Transaction,
  VersionedTransaction,
  PublicKey,
} from "@solana/web3.js";

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
  protocolFeeAmount?: string;
  programName?: string;
  /** Raw multiRoute object, passed back to buildSwapTransaction */
  route: unknown;
  _source?: "cookiescan" | "cookiebox";
}

export interface SwapTxResult {
  /** Base64-encoded serialized transaction */
  transaction: string;
  transactionBase64?: string;
}

// ─── Quote ───────────────────────────────────────────────────────────────────

/**
 * Fetch a swap quote from the Cookie Chain swap router.
 *
 * @param inputMint   Source token mint address
 * @param outputMint  Destination token mint address
 * @param amount      Input amount in base units (string to avoid precision loss)
 * @param slippageBps Slippage tolerance in basis points (default 500 = 5%)
 * @param owner       Optional: wallet public key
 */
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
  owner?: string
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
  });
  if (owner) params.set("owner", owner);

  // Use local server proxy route to avoid browser CORS restrictions
  const endpoint =
    typeof window !== "undefined"
      ? `/api/swap/quote?${params}`
      : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/swap/quote?${params}`;

  const res = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errJson;
    try {
      errJson = JSON.parse(errText);
    } catch {
      // not JSON
    }

    const message =
      errJson?.error ||
      (res.status === 404
        ? "No swap route available for this token pair."
        : `Quote failed (${res.status})`);
    throw new Error(message);
  }

  const data = (await res.json()) as SwapQuote;
  return data;
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
  const endpoint =
    typeof window !== "undefined"
      ? "/api/swap/build-tx"
      : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/swap/build-tx`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      multiRoute: quote.route,
      userPublicKey,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errJson;
    try {
      errJson = JSON.parse(errText);
    } catch {
      // not JSON
    }
    throw new Error(
      errJson?.error || `Failed to build swap transaction (${res.status})`
    );
  }

  const data = (await res.json()) as SwapTxResult;
  const rawTx = data.transaction || data.transactionBase64;
  if (!rawTx) {
    throw new Error("No transaction returned from swap builder");
  }

  return deserializeTransaction(rawTx);
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
      });
      if (result.value.err) {
        return {
          ok: false,
          error: formatSimError(result.value.err),
        };
      }
    } else {
      const result = await connection.simulateTransaction(tx, []);
      if (result.value.err) {
        return {
          ok: false,
          error: formatSimError(result.value.err),
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

function formatSimError(err: unknown): string {
  const str = JSON.stringify(err);
  if (str.includes("insufficient lamports") || str.includes("Custom\":1")) {
    return "Insufficient balance for transaction fees or token swap amount.";
  }
  if (str.includes("SlippageExceeded") || str.includes("6000")) {
    return "Slippage tolerance exceeded. Try increasing slippage in settings.";
  }
  return `Simulation failed: ${str}`;
}

// ─── Price Impact ─────────────────────────────────────────────────────────────

/** Classify price impact severity for UI warning display. */
export function priceImpactSeverity(
  pct: number
): "low" | "medium" | "high" | "very-high" {
  if (pct < 1) return "low";
  if (pct < 3) return "medium";
  if (pct < 5) return "high";
  return "very-high";
}
