/**
 * lib/bridge.ts
 * Hyperlane Warp Route bridge integration between Cookie Chain and Solana Mainnet.
 * Handles decimal normalization (9 decimals native COOK vs 6 decimals Solana Token-2022),
 * destination collateral preflighting, message status tracking, and 2-phase settlement.
 */

import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getConnection, COOKIE_RPC } from "./chain";

// ─── Constants & Program IDs (Verified from cookiechain reference) ────────────

export const COOKIE_WARP_PROGRAM_ID = "Aa9wq46NB7qkg1amnBuMRsV1DunmkPHuoRLWZgWiBKdn";
export const SOLANA_WARP_PROGRAM_ID = "B1C91jLcqXYYz57bBWR8dSEjBrJDhWSeNokZ5SDEopu3";

/** Bridged COOK representation on Solana (Token-2022, 6 decimals) */
export const SOLANA_WARP_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";
export const SOLANA_WARP_DECIMALS = 6;

/** Native COOK on Cookie Chain (9 decimals) */
export const COOKIE_NATIVE_DECIMALS = 9;

/** Hyperlane Domain IDs */
export const COOKIE_CHAIN_DOMAIN = 20241024;
export const SOLANA_MAINNET_DOMAIN = 1399811149;

export const OFFICIAL_BRIDGE_URL = "https://bridge.cookiechain.wtf";
export const HYPERLANE_EXPLORER_BASE = "https://explorer.hyperlane.xyz/message";

export type BridgeDirection = "cookie-to-solana" | "solana-to-cookie";

export interface BridgeQuote {
  direction: BridgeDirection;
  sourceAmount: number;
  destAmount: number;
  sourceDecimals: number;
  destDecimals: number;
  estimatedRelayerTime: string;
  sourceFeeCook: number;
  interchainFee: number;
  destinationCollateralAvailable: number;
  sufficientCollateral: boolean;
}

export interface BridgeTransferRecord {
  id: string;
  txHash: string;
  messageId?: string;
  direction: BridgeDirection;
  amount: number;
  timestamp: number;
  status: "dispatched" | "awaiting_delivery" | "delivered" | "failed";
  sender: string;
  recipient: string;
}

// ─── Solana Mainnet COOK Balance Reader ─────────────────────────────────────

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/**
 * Reads the user's bridged COOK (Token-2022) balance on Solana Mainnet.
 * Calls our server route first (which proxies to Solana RPC without browser Origin blocks),
 * with client-side fallback.
 */
export async function getSolanaCookBalance(ownerAddress: string | PublicKey): Promise<number> {
  const pubkeyStr = typeof ownerAddress === "string" ? ownerAddress : ownerAddress.toBase58();

  // 1. Primary: Query via server API route to bypass browser CORS / 403 Forbidden on Solana public RPCs
  try {
    const res = await fetch(`/api/solana-balance?address=${pubkeyStr}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.balance === "number") {
        return data.balance;
      }
    }
  } catch {
    // API route not reachable, proceed to direct RPC fallback
  }

  // 2. Secondary: Direct RPC fallback
  const pubkey = new PublicKey(pubkeyStr);
  const rpcs = [
    SOLANA_RPC,
    "https://api.mainnet-beta.solana.com",
  ];

  for (const rpc of rpcs) {
    try {
      const conn = new Connection(rpc, "confirmed");
      const mintPubkey = new PublicKey(SOLANA_WARP_MINT);

      const [ata] = PublicKey.findProgramAddressSync(
        [pubkey.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mintPubkey.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        const bal = await conn.getTokenAccountBalance(ata);
        if (bal.value.uiAmount !== null && bal.value.uiAmount !== undefined) {
          return bal.value.uiAmount;
        }
      } catch {
        // ATA uninitialized or not found
      }

      const accounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
        mint: mintPubkey,
      });

      if (accounts.value.length > 0) {
        let total = 0;
        for (const a of accounts.value) {
          total += a.account.data.parsed.info.tokenAmount.uiAmount || 0;
        }
        return total;
      }

      return 0;
    } catch {
      // try next RPC
    }
  }
  return 0;
}

// ─── Destination Collateral Preflight ──────────────────────────────────────────

// ─── Destination Collateral Preflight & Live Reserves ─────────────────────────

export interface BridgeReservesData {
  cookie: {
    balance: number;
    decimals: number;
    collateralAddress: string;
    symbol: string;
    paysOutDirection: string;
    chain: string;
  };
  solana: {
    balance: number;
    decimals: number;
    collateralAddress: string;
    symbol: string;
    paysOutDirection: string;
    chain: string;
  };
}

/**
 * Fetches live collateral reserves from the Hyperlane Warp Route contract pools.
 */
export async function getLiveBridgeReserves(): Promise<BridgeReservesData | null> {
  try {
    const res = await fetch("/api/bridge/reserves", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (res.ok) {
      return (await res.json()) as BridgeReservesData;
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Preflights destination collateral account balance before initiating a bridge transfer.
 * If user transfers more than the fixed collateral on the destination chain,
 * funds would be locked without on-chain simulation detecting it.
 */
export async function getDestinationCollateral(
  direction: BridgeDirection
): Promise<{ available: number; maxTransfer: number }> {
  try {
    const reserves = await getLiveBridgeReserves();
    if (reserves) {
      if (direction === "cookie-to-solana") {
        // Destination is Solana
        const avail = reserves.solana.balance;
        return { available: avail, maxTransfer: Math.min(avail * 0.9, 1000000) };
      } else {
        // Destination is Cookie Chain
        const avail = reserves.cookie.balance;
        return { available: avail, maxTransfer: Math.min(avail * 0.9, 1000000) };
      }
    }
  } catch {
    // fallback to safe defaults
  }

  return {
    available: direction === "cookie-to-solana" ? 120000000 : 70000000,
    maxTransfer: 500000,
  };
}

// ─── Quote Calculation ────────────────────────────────────────────────────────

/**
 * Calculates 1:1 bridge amounts with proper decimal adjustment:
 * - Cookie Chain native COOK: 9 decimals
 * - Solana Token-2022 COOK: 6 decimals
 */
export function calculateBridgeAmounts(
  amountStr: string,
  direction: BridgeDirection,
  collateralAvailable = 2500000
): BridgeQuote | null {
  const num = parseFloat(amountStr);
  if (isNaN(num) || num <= 0) return null;

  const isCookieToSolana = direction === "cookie-to-solana";
  const sourceDecimals = isCookieToSolana ? COOKIE_NATIVE_DECIMALS : SOLANA_WARP_DECIMALS;
  const destDecimals = isCookieToSolana ? SOLANA_WARP_DECIMALS : COOKIE_NATIVE_DECIMALS;

  // 1 COOK bridges 1:1
  const sourceAmount = num;
  const destAmount = Number(num.toFixed(destDecimals));

  return {
    direction,
    sourceAmount,
    destAmount,
    sourceDecimals,
    destDecimals,
    estimatedRelayerTime: "1–3 minutes",
    sourceFeeCook: 0.005,
    interchainFee: 0.01,
    destinationCollateralAvailable: collateralAvailable,
    sufficientCollateral: sourceAmount <= collateralAvailable,
  };
}

// ─── Direct In-App Bridge Transaction Execution ──────────────────────────────

export interface BuiltBridgeTx {
  transaction: VersionedTransaction;
  uniqueMessageAccount: string;
  sourceRpc: string;
  destinationDomain: number;
  txBase64: string;
}

/**
 * Builds the serialized VersionedTransaction on the Hyperlane Warp Route
 * for direct in-app signing and submission.
 */
export async function buildBridgeTransaction(params: {
  direction: BridgeDirection;
  fromAddress: string;
  toAddress: string;
  amount: number | string;
}): Promise<BuiltBridgeTx> {
  const res = await fetch("/api/bridge/build-tx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direction: params.direction,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      amount: params.amount.toString().trim(),
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to build bridge transaction (${res.status})`);
  }

  const data = await res.json();
  const txBuffer = Buffer.from(data.txBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  return {
    transaction,
    uniqueMessageAccount: data.uniqueMessageAccount,
    sourceRpc: data.sourceRpc,
    destinationDomain: data.destinationDomain,
    txBase64: data.txBase64,
  };
}

/**
 * Extracts Hyperlane 32-byte (64 hex character) message ID from transaction log messages.
 */
export function extractHyperlaneMessageId(logMessages?: string[] | null): string | null {
  if (!logMessages || !logMessages.length) return null;

  for (const log of logMessages) {
    const match = log.match(/ID (0x[a-fA-F0-9]{64})/i);
    if (match) return match[1].toLowerCase();
  }

  for (const log of logMessages) {
    const match = log.match(/(0x[a-fA-F0-9]{64})/);
    if (match) return match[1].toLowerCase();
  }

  return null;
}

// ─── Message Status & Hyperlane Explorer URL ─────────────────────────────────

export function getHyperlaneMessageUrl(messageId: string): string {
  return `${HYPERLANE_EXPLORER_BASE}/${messageId}`;
}

/**
 * Checks destination chain delivery status by Hyperlane message ID.
 */
export async function checkBridgeDelivery(
  messageId: string,
  destChain: "cookie" | "solana"
): Promise<{ delivered: boolean; deliveryTx?: string }> {
  try {
    const res = await fetch(`/api/bridge/delivered/${encodeURIComponent(messageId)}?dest=${destChain}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        delivered: !!data.delivered,
        deliveryTx: data.deliveryTx,
      };
    }
  } catch {
    // pending
  }
  return { delivered: false };
}

/**
 * Broadcasts a signed bridge transaction to the appropriate network.
 */
export async function broadcastBridgeTransaction(
  signedTx: VersionedTransaction,
  chain: "cookie" | "solana"
): Promise<string> {
  const rawTxBase64 = Buffer.from(signedTx.serialize()).toString("base64");
  const res = await fetch("/api/bridge/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawTxBase64, chain }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Broadcast failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.txHash;
}

