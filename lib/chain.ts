/**
 * lib/chain.ts
 * Cookie Chain connection setup, genesis-hash sanity check, and RPC helpers.
 * All chain-level config lives here — never hardcode endpoints in components.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ─── Config ────────────────────────────────────────────────────────────────

export const COOKIE_RPC   = process.env.NEXT_PUBLIC_COOKIE_RPC   ?? "https://rpc.cookiescan.io";
export const COOKIE_WSS   = process.env.NEXT_PUBLIC_COOKIE_WSS   ?? "wss://wss.cookiescan.io";
export const COOKIE_EXPLORER = process.env.NEXT_PUBLIC_COOKIE_EXPLORER ?? "https://cookiescan.io";

/** The Cookie Chain mainnet genesis hash — used as a hard guard against mis-configuration. */
export const EXPECTED_GENESIS_HASH = "9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2";

/** Native asset: COOK — 9 decimals */
export const NATIVE_MINT_DECIMALS = 9;

/** Native wCOOK / COOK mint address on Cookie Chain */
export const COOK_MINT = "So11111111111111111111111111111111111111112";

/** Bridged COOK on Solana mainnet (Token-2022, 6 decimals) */
export const SOLANA_WARP_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

/** SPL Memo program (same address as Solana — SVM-compatible) */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

// ─── Connection ─────────────────────────────────────────────────────────────

let _connection: Connection | null = null;

/** Returns a singleton Connection pointed at the Cookie Chain RPC. */
export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(COOKIE_RPC, {
      wsEndpoint: COOKIE_WSS,
      commitment: "confirmed",
    });
  }
  return _connection;
}

// ─── Genesis Hash Sanity Check ──────────────────────────────────────────────

export type GenesisCheckResult =
  | { ok: true; hash: string }
  | { ok: false; expected: string; actual: string; error?: string };

/**
 * Verifies the connected RPC is actually Cookie Chain mainnet.
 * Should be called once on app boot — if it fails, the app must NOT proceed.
 */
export async function checkGenesisHash(): Promise<GenesisCheckResult> {
  try {
    const conn = getConnection();
    const hash = await conn.getGenesisHash();
    if (hash === EXPECTED_GENESIS_HASH) {
      return { ok: true, hash };
    }
    return { ok: false, expected: EXPECTED_GENESIS_HASH, actual: hash };
  } catch (err) {
    return {
      ok: false,
      expected: EXPECTED_GENESIS_HASH,
      actual: "unknown",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Explorer Helpers ───────────────────────────────────────────────────────

export function explorerTxUrl(signature: string): string {
  return `${COOKIE_EXPLORER}/tx/${signature}`;
}

export function explorerAddressUrl(address: string): string {
  return `${COOKIE_EXPLORER}/address/${address}`;
}

export function explorerTokenUrl(mint: string): string {
  return `${COOKIE_EXPLORER}/token/${mint}`;
}

// ─── Real Wallet Balance Readers ────────────────────────────────────────────

/**
 * Returns native COOK balance in human-readable decimal units (divided by 10^9).
 */
export async function getCookBalance(address: string | PublicKey): Promise<number> {
  try {
    const conn = getConnection();
    const pubkey = typeof address === "string" ? new PublicKey(address) : address;
    const lamports = await conn.getBalance(pubkey);
    return lamports / 10 ** NATIVE_MINT_DECIMALS;
  } catch {
    return 0;
  }
}

/**
 * Returns SPL token balance for a specific mint and owner.
 */
export async function getTokenBalance(
  ownerAddress: string | PublicKey,
  mintAddress: string | PublicKey
): Promise<{ amount: string; uiAmount: number; decimals: number } | null> {
  try {
    const conn = getConnection();
    const owner = typeof ownerAddress === "string" ? new PublicKey(ownerAddress) : ownerAddress;
    const mint = typeof mintAddress === "string" ? new PublicKey(mintAddress) : mintAddress;

    const accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint });
    if (accounts.value.length === 0) return null;

    const info = accounts.value[0].account.data.parsed.info.tokenAmount;
    return {
      amount: info.amount,
      uiAmount: info.uiAmount ?? 0,
      decimals: info.decimals,
    };
  } catch {
    return null;
  }
}
