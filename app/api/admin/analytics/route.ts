import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "@/lib/chain";
import { getCookPrice } from "@/lib/das";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_COOKIE_NAME = "glassjar_admin_session";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

function decodeBase58(raw: string): Uint8Array {
  const fn = (bs58 as any).decode || (bs58 as any).default?.decode;
  if (typeof fn !== "function") {
    throw new Error("bs58 decode function not available");
  }
  return fn(raw);
}

function getFaucetPublicKey(): PublicKey | null {
  const raw = process.env.FAUCET_PAYER_PRIVATE_KEY;
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr)).publicKey;
    }
    return Keypair.fromSecretKey(decodeBase58(raw)).publicKey;
  } catch {
    return null;
  }
}

function verifySessionToken(token: string, password?: string): boolean {
  if (!token || !password) return false;

  const currentHour = Math.floor(Date.now() / 1000 / 3600);
  for (let i = 0; i <= 24; i++) {
    const expected = crypto
      .createHmac("sha256", password + "_salt_secret")
      .update(`glassjar_admin_${currentHour - i}`)
      .digest("hex");
    if (token === expected) return true;
  }
  return false;
}

export async function GET(request: Request) {
  try {
    // 1. Session verification
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );

    const token = cookies[SESSION_COOKIE_NAME];
    if (!token || !verifySessionToken(token, ADMIN_PASSWORD)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({
        error: "Supabase credentials are not configured in environment variables",
        isMock: true,
      }, { status: 500 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const faucetPubkey = getFaucetPublicKey();

    // 2. Query Wallets
    const [
      walletsTotalRes,
      wallets24hRes,
      activeWalletsRes,
      txTotalRes,
      txSwapsRes,
      txBridgesRes,
      recentTxRes,
      eventsTotalRes,
      recentEventsRes,
      watchlistTotalRes,
      topWatchlistRes,
      faucetTotalRes,
      faucet24hRes,
      recentFaucetRes,
      allFaucetStatsRes,
      faucetBalanceRes,
      cookPriceRes,
    ] = await Promise.allSettled([
      // Total Wallets
      sb.from("wallets").select("*", { count: "exact", head: true }),
      // New wallets in last 24h
      sb.from("wallets").select("*", { count: "exact", head: true }).gte("first_connected_at", past24h),
      // Active Wallets List
      sb.from("wallets").select("*").order("last_seen_at", { ascending: false }).limit(50),

      // Total Transactions
      sb.from("transactions").select("*", { count: "exact", head: true }),
      // Swaps Count
      sb.from("transactions").select("*", { count: "exact", head: true }).eq("tx_type", "swap"),
      // Bridges Count
      sb.from("transactions").select("*", { count: "exact", head: true }).eq("tx_type", "bridge"),
      // Recent Transactions
      sb.from("transactions").select("*").order("created_at", { ascending: false }).limit(50),

      // Total Analytics Events
      sb.from("analytics_events").select("*", { count: "exact", head: true }),
      // Recent Events
      sb.from("analytics_events").select("*").order("created_at", { ascending: false }).limit(50),

      // Total Watchlists
      sb.from("watchlists").select("*", { count: "exact", head: true }),
      // Top watchlisted tokens
      sb.from("watchlists").select("symbol, mint, name, logo_uri"),

      // Faucet Claims
      sb.from("faucet_claims").select("*", { count: "exact", head: true }),
      sb.from("faucet_claims").select("*", { count: "exact", head: true }).gte("created_at", past24h),
      sb.from("faucet_claims").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("faucet_claims").select("amount_lamports, amount_usd, wallet_address"),

      // Faucet live on-chain balance & spot price
      faucetPubkey ? getConnection().getBalance(faucetPubkey) : Promise.resolve(null),
      getCookPrice().catch(() => 0),
    ]);

    const totalWallets = walletsTotalRes.status === "fulfilled" ? walletsTotalRes.value.count || 0 : 0;
    const newWallets24h = wallets24hRes.status === "fulfilled" ? wallets24hRes.value.count || 0 : 0;
    const activeWallets = activeWalletsRes.status === "fulfilled" ? activeWalletsRes.value.data || [] : [];

    const totalTx = txTotalRes.status === "fulfilled" ? txTotalRes.value.count || 0 : 0;
    const totalSwaps = txSwapsRes.status === "fulfilled" ? txSwapsRes.value.count || 0 : 0;
    const totalBridges = txBridgesRes.status === "fulfilled" ? txBridgesRes.value.count || 0 : 0;
    const recentTx = recentTxRes.status === "fulfilled" ? recentTxRes.value.data || [] : [];

    const totalEvents = eventsTotalRes.status === "fulfilled" ? eventsTotalRes.value.count || 0 : 0;
    const recentEvents = recentEventsRes.status === "fulfilled" ? recentEventsRes.value.data || [] : [];
    const totalWatchlists = watchlistTotalRes.status === "fulfilled" ? watchlistTotalRes.value.count || 0 : 0;

    // Faucet aggregations
    const totalFaucetClaims = faucetTotalRes.status === "fulfilled" ? faucetTotalRes.value.count || 0 : 0;
    const faucetClaims24h = faucet24hRes.status === "fulfilled" ? faucet24hRes.value.count || 0 : 0;
    const recentFaucetClaims = recentFaucetRes.status === "fulfilled" ? recentFaucetRes.value.data || [] : [];

    let totalCookDistributed = 0;
    let totalUsdDistributed = 0;
    const uniqueFaucetWalletsSet = new Set<string>();

    if (allFaucetStatsRes.status === "fulfilled" && allFaucetStatsRes.value.data) {
      for (const claim of allFaucetStatsRes.value.data) {
        if (claim.wallet_address) uniqueFaucetWalletsSet.add(claim.wallet_address);
        if (claim.amount_lamports) {
          totalCookDistributed += Number(claim.amount_lamports) / 1e9;
        }
        if (claim.amount_usd) {
          totalUsdDistributed += Number(claim.amount_usd);
        }
      }
    }

    // Faucet live balance & spot price calculation
    const faucetBalanceLamports =
      faucetBalanceRes.status === "fulfilled" && typeof faucetBalanceRes.value === "number"
        ? faucetBalanceRes.value
        : null;
    const cookPrice =
      cookPriceRes.status === "fulfilled" && typeof cookPriceRes.value === "number"
        ? cookPriceRes.value
        : 0;
    const faucetBalanceCook = faucetBalanceLamports !== null ? faucetBalanceLamports / 1e9 : null;
    const faucetBalanceUsd =
      faucetBalanceCook !== null && cookPrice > 0 ? faucetBalanceCook * cookPrice : null;

    // Aggregate Popular Tokens from Watchlist
    const tokenCounts: Record<string, { symbol: string; mint: string; name?: string; logo_uri?: string; count: number }> = {};
    if (topWatchlistRes.status === "fulfilled" && topWatchlistRes.value.data) {
      for (const item of topWatchlistRes.value.data) {
        if (!tokenCounts[item.mint]) {
          tokenCounts[item.mint] = {
            symbol: item.symbol,
            mint: item.mint,
            name: item.name,
            logo_uri: item.logo_uri,
            count: 0,
          };
        }
        tokenCounts[item.mint].count += 1;
      }
    }
    const popularTokens = Object.values(tokenCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Calculate volume breakdown from recent transactions
    let totalCookVolume = 0;
    let totalSolVolume = 0;
    for (const tx of recentTx) {
      if (tx.input_symbol === "COOK" || tx.output_symbol === "COOK") {
        totalCookVolume += Number(tx.input_amount || tx.output_amount || 0);
      }
      if (tx.input_symbol === "SOL") {
        totalSolVolume += Number(tx.input_amount || 0);
      }
    }

    return NextResponse.json({
      metrics: {
        totalWallets,
        newWallets24h,
        totalTx,
        totalSwaps,
        totalBridges,
        totalEvents,
        totalWatchlists,
        totalCookVolume,
        totalSolVolume,
        faucetClaims: totalFaucetClaims,
        faucetClaims24h,
        faucetCookDistributed: totalCookDistributed,
        faucetUsdDistributed: totalUsdDistributed,
        faucetUniqueWallets: uniqueFaucetWalletsSet.size,
        faucetWalletAddress: faucetPubkey ? faucetPubkey.toBase58() : null,
        faucetWalletBalanceCook: faucetBalanceCook,
        faucetWalletBalanceUsd: faucetBalanceUsd,
        cookPriceUsd: cookPrice,
      },
      activeWallets,
      recentTx,
      recentEvents,
      popularTokens,
      faucet: {
        wallet: {
          address: faucetPubkey ? faucetPubkey.toBase58() : null,
          balanceCook: faucetBalanceCook,
          balanceUsd: faucetBalanceUsd,
          cookPriceUsd: cookPrice,
        },
        metrics: {
          totalClaims: totalFaucetClaims,
          claims24h: faucetClaims24h,
          totalCookDistributed,
          totalUsdDistributed,
          uniqueWallets: uniqueFaucetWalletsSet.size,
        },
        recentClaims: recentFaucetClaims,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
