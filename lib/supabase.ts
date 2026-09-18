/**
 * lib/supabase.ts
 * Supabase client and typed data-access layer for GlassJar off-chain storage:
 * - Wallet connection logging & user preferences
 * - Per-wallet persistent watchlists with cloud sync
 * - Analytics & usage telemetry (swaps, bridges, connections)
 * - Cached recent transactions
 *
 * NOTE: Balances and on-chain states are always derived directly from
 * Cookie Chain RPC. Supabase is strictly an off-chain cache and convenience layer.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistItem } from "./watchlist";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }
  try {
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return _supabase;
  } catch (err) {
    console.warn("[Supabase] Failed to initialize client:", err);
    return null;
  }
}

// ─── 1. WALLET CONNECTIONS ───────────────────────────────────────────────────

export interface WalletRecord {
  address: string;
  first_connected_at: string;
  last_seen_at: string;
  connection_count: number;
  wallet_name?: string | null;
  preferences?: Record<string, unknown>;
}

/**
 * Record or update a wallet connection in the database.
 * Increments connection_count and updates last_seen_at.
 */
export async function recordWalletConnection(
  address: string,
  walletName?: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !address) return;

  try {
    // 1. Check if wallet exists
    const { data: existing } = await sb
      .from("wallets")
      .select("address, connection_count")
      .eq("address", address)
      .maybeSingle();

    if (existing) {
      // Update existing wallet
      await sb
        .from("wallets")
        .update({
          last_seen_at: new Date().toISOString(),
          connection_count: (existing.connection_count || 1) + 1,
          wallet_name: walletName || undefined,
        })
        .eq("address", address);
    } else {
      // Insert new wallet
      await sb.from("wallets").insert({
        address,
        first_connected_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        connection_count: 1,
        wallet_name: walletName,
      });
    }

    // Also log connection event
    await logAnalyticsEvent("wallet_connect", { walletName }, address);
  } catch (err) {
    console.warn("[Supabase] Failed to record wallet connection:", err);
  }
}

// ─── 2. WATCHLIST PERSISTENCE ────────────────────────────────────────────────

export interface DbWatchlistItem {
  id?: string;
  wallet_address: string;
  mint: string;
  symbol: string;
  name: string;
  decimals?: number;
  logo_uri?: string | null;
  added_price: number;
  target_price?: number | null;
  notes?: string | null;
  tracked_amount?: number | null;
  added_at: string;
  updated_at?: string;
}

/**
 * Fetch all watchlist items for a given wallet from Supabase.
 */
export async function fetchWalletWatchlist(
  walletAddress: string
): Promise<WatchlistItem[]> {
  const sb = getSupabase();
  if (!sb || !walletAddress) return [];

  try {
    const { data, error } = await sb
      .from("watchlists")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("added_at", { ascending: false });

    if (error || !data) return [];

    return data.map((row) => ({
      mint: row.mint,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals ?? 9,
      logoUri: row.logo_uri,
      addedPrice: Number(row.added_price) || 0,
      addedAt: new Date(row.added_at).getTime(),
      targetPrice: row.target_price ? Number(row.target_price) : undefined,
      notes: row.notes || undefined,
      trackedAmount: row.tracked_amount ? Number(row.tracked_amount) : undefined,
    }));
  } catch (err) {
    console.warn("[Supabase] Failed to fetch watchlist:", err);
    return [];
  }
}

/**
 * Save or update a watchlist item in Supabase.
 */
export async function upsertWatchlistDbItem(
  item: WatchlistItem,
  walletAddress: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !walletAddress) return;

  try {
    // Ensure wallet record exists first (foreign key requirement)
    await recordWalletConnection(walletAddress);

    await sb.from("watchlists").upsert(
      {
        wallet_address: walletAddress,
        mint: item.mint,
        symbol: item.symbol,
        name: item.name,
        decimals: item.decimals ?? 9,
        logo_uri: item.logoUri,
        added_price: item.addedPrice,
        target_price: item.targetPrice ?? null,
        notes: item.notes ?? null,
        tracked_amount: item.trackedAmount ?? null,
        added_at: new Date(item.addedAt).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address,mint" }
    );

    // Log telemetry
    await logAnalyticsEvent(
      "watchlist_add",
      { mint: item.mint, symbol: item.symbol },
      walletAddress
    );
  } catch (err) {
    console.warn("[Supabase] Failed to upsert watchlist item:", err);
  }
}

/**
 * Remove a token from a wallet's watchlist in Supabase.
 */
export async function removeWatchlistDbItem(
  mint: string,
  walletAddress: string
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !walletAddress) return;

  try {
    await sb
      .from("watchlists")
      .delete()
      .eq("wallet_address", walletAddress)
      .eq("mint", mint);

    await logAnalyticsEvent("watchlist_remove", { mint }, walletAddress);
  } catch (err) {
    console.warn("[Supabase] Failed to remove watchlist item:", err);
  }
}

// ─── 3. ANALYTICS & USAGE TELEMETRY ──────────────────────────────────────────

export type AnalyticsEventType =
  | "wallet_connect"
  | "swap_executed"
  | "bridge_initiated"
  | "bridge_delivered"
  | "watchlist_add"
  | "watchlist_remove"
  | "page_view";

/**
 * Logs a platform usage event for dashboard stats and analytics.
 */
export async function logAnalyticsEvent(
  eventType: AnalyticsEventType | string,
  metadata?: Record<string, unknown>,
  walletAddress?: string | null
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;

  try {
    await sb.from("analytics_events").insert({
      event_type: eventType,
      wallet_address: walletAddress || null,
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Fail silently so analytics never block UI
  }
}

// ─── 4. TRANSACTIONS CACHE ────────────────────────────────────────────────────

export interface TransactionRecord {
  signature: string;
  wallet_address: string;
  tx_type: "swap" | "bridge";
  source_chain: "cookie" | "solana";
  dest_chain?: string;
  input_mint?: string;
  input_symbol?: string;
  input_amount?: number;
  output_mint?: string;
  output_symbol?: string;
  output_amount?: number;
  status?: "confirmed" | "delivered" | "failed";
  message_id?: string;
  created_at?: string;
}

/**
 * Record a completed or pending swap / bridge transaction.
 */
export async function recordTransactionDb(
  tx: TransactionRecord
): Promise<void> {
  const sb = getSupabase();
  if (!sb || !tx.signature) return;

  try {
    await sb.from("transactions").upsert(
      {
        signature: tx.signature,
        wallet_address: tx.wallet_address,
        tx_type: tx.tx_type,
        source_chain: tx.source_chain,
        dest_chain: tx.dest_chain || null,
        input_mint: tx.input_mint || null,
        input_symbol: tx.input_symbol || null,
        input_amount: tx.input_amount ?? null,
        output_mint: tx.output_mint || null,
        output_symbol: tx.output_symbol || null,
        output_amount: tx.output_amount ?? null,
        status: tx.status || "confirmed",
        message_id: tx.message_id || null,
        created_at: tx.created_at || new Date().toISOString(),
      },
      { onConflict: "signature" }
    );

    // Also log corresponding analytics event
    await logAnalyticsEvent(
      tx.tx_type === "swap" ? "swap_executed" : "bridge_initiated",
      {
        signature: tx.signature,
        sourceChain: tx.source_chain,
        destChain: tx.dest_chain,
        inputSymbol: tx.input_symbol,
        outputSymbol: tx.output_symbol,
        inputAmount: tx.input_amount,
        outputAmount: tx.output_amount,
      },
      tx.wallet_address
    );
  } catch (err) {
    console.warn("[Supabase] Failed to record transaction:", err);
  }
}

/**
 * Fetch cached transactions for a wallet.
 */
export async function fetchWalletTransactionsDb(
  walletAddress: string,
  limit = 20
): Promise<TransactionRecord[]> {
  const sb = getSupabase();
  if (!sb || !walletAddress) return [];

  try {
    const { data, error } = await sb
      .from("transactions")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as TransactionRecord[];
  } catch {
    return [];
  }
}

// ─── 5. PLATFORM METRICS & STATS ──────────────────────────────────────────────

export interface PlatformStats {
  totalConnectedWallets: number;
  totalSwapsCompleted: number;
  totalBridgesCompleted: number;
  totalEventsLogged: number;
}

/**
 * Fetch total platform metrics (e.g. for dashboard or footer stats).
 */
export async function fetchPlatformStats(): Promise<PlatformStats> {
  const sb = getSupabase();
  if (!sb) {
    return {
      totalConnectedWallets: 0,
      totalSwapsCompleted: 0,
      totalBridgesCompleted: 0,
      totalEventsLogged: 0,
    };
  }

  try {
    // Try reading from helper view first
    const { data: viewData } = await sb
      .from("v_platform_stats")
      .select("*")
      .maybeSingle();

    if (viewData) {
      return {
        totalConnectedWallets: Number(viewData.total_connected_wallets) || 0,
        totalSwapsCompleted: Number(viewData.total_swaps_completed) || 0,
        totalBridgesCompleted: Number(viewData.total_bridges_completed) || 0,
        totalEventsLogged: Number(viewData.total_events_logged) || 0,
      };
    }

    // Fallback: direct table counts
    const [{ count: walletsCount }, { count: swapsCount }, { count: bridgesCount }] =
      await Promise.all([
        sb.from("wallets").select("*", { count: "exact", head: true }),
        sb.from("transactions").select("*", { count: "exact", head: true }).eq("tx_type", "swap"),
        sb.from("transactions").select("*", { count: "exact", head: true }).eq("tx_type", "bridge"),
      ]);

    return {
      totalConnectedWallets: walletsCount ?? 0,
      totalSwapsCompleted: swapsCount ?? 0,
      totalBridgesCompleted: bridgesCount ?? 0,
      totalEventsLogged: 0,
    };
  } catch {
    return {
      totalConnectedWallets: 0,
      totalSwapsCompleted: 0,
      totalBridgesCompleted: 0,
      totalEventsLogged: 0,
    };
  }
}
