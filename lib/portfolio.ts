/**
 * lib/portfolio.ts
 * Real-time Cookie Chain Portfolio data aggregation layer.
 * Pulls native COOK and all SPL token holdings on-chain, enriches with metadata & pricing,
 * and fetches live confirmed wallet activity from Cookiescan Explorer API.
 */

import { PublicKey } from "@solana/web3.js";
import { getConnection, COOK_MINT, NATIVE_MINT_DECIMALS } from "./chain";
import { getAllTokens, getCookPrice, type Token } from "./das";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export interface PortfolioHolding {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  balance: number;
  rawBalance: string;
  priceUsd: number;
  valueUsd: number;
  change24h?: number;
  allocationPct: number;
  isNativeCook?: boolean;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  cookBalance: number;
  cookValueUsd: number;
  tokensValueUsd: number;
  change24hUsd: number;
  change24hPct: number;
  holdings: PortfolioHolding[];
  assetCount: number;
}

export interface WalletTransaction {
  signature: string;
  blockHeight?: number;
  slot?: number;
  fee?: string;
  status: "success" | "failed";
  timestamp: number; // Unix seconds
  type: string;
  instructionsCount: number;
}

/**
 * Fetches real-time portfolio balance summary for a connected wallet address.
 */
export async function fetchWalletPortfolio(ownerAddress: string): Promise<PortfolioSummary> {
  const conn = getConnection();
  const ownerPubkey = new PublicKey(ownerAddress);

  // Parallel fetch: native balance, SPL token accounts, Token-2022 accounts, token registry, and COOK price
  const [lamportsRes, splAccountsRes, token2022AccountsRes, allTokensRes, cookPriceRes] = await Promise.allSettled([
    conn.getBalance(ownerPubkey),
    conn.getParsedTokenAccountsByOwner(ownerPubkey, { programId: TOKEN_PROGRAM_ID }),
    conn.getParsedTokenAccountsByOwner(ownerPubkey, { programId: TOKEN_2022_PROGRAM_ID }),
    getAllTokens(),
    getCookPrice(),
  ]);

  const lamports = lamportsRes.status === "fulfilled" ? lamportsRes.value : 0;
  const cookBalance = lamports / 10 ** NATIVE_MINT_DECIMALS;
  const cookPrice = (cookPriceRes.status === "fulfilled" && cookPriceRes.value) ? cookPriceRes.value : 0.000064;
  const cookValueUsd = cookBalance * cookPrice;

  // Build token lookup map from registry
  const tokenMap = new Map<string, Token>();
  if (allTokensRes.status === "fulfilled" && Array.isArray(allTokensRes.value)) {
    for (const t of allTokensRes.value) {
      tokenMap.set(t.mint.toLowerCase(), t);
    }
  }

  // Aggregate SPL accounts
  const rawAccounts = [
    ...(splAccountsRes.status === "fulfilled" ? splAccountsRes.value.value : []),
    ...(token2022AccountsRes.status === "fulfilled" ? token2022AccountsRes.value.value : []),
  ];

  const holdingsMap = new Map<string, PortfolioHolding>();

  // Add native COOK first
  if (cookBalance > 0) {
    const cookToken = tokenMap.get(COOK_MINT.toLowerCase());
    holdingsMap.set("native_cook", {
      mint: COOK_MINT,
      symbol: "COOK",
      name: "Cookie Chain Native",
      decimals: NATIVE_MINT_DECIMALS,
      logoUri: cookToken?.logoUri || "https://cookiescan.io/images/cookie-logo.png",
      balance: cookBalance,
      rawBalance: lamports.toString(),
      priceUsd: cookPrice,
      valueUsd: cookValueUsd,
      change24h: cookToken?.priceChange24h,
      allocationPct: 0,
      isNativeCook: true,
    });
  }

  for (const acc of rawAccounts) {
    try {
      const info = acc.account.data.parsed.info;
      const mintAddress: string = info.mint;
      const uiAmt: number = info.tokenAmount.uiAmount ?? 0;
      const decimals: number = info.tokenAmount.decimals;
      const rawAmt: string = info.tokenAmount.amount;

      if (uiAmt <= 0) continue;

      const registered = tokenMap.get(mintAddress.toLowerCase());
      const price = registered?.price ?? 0;
      const valueUsd = uiAmt * price;
      const existing = holdingsMap.get(mintAddress.toLowerCase());

      if (existing) {
        existing.balance += uiAmt;
        existing.valueUsd += valueUsd;
      } else {
        holdingsMap.set(mintAddress.toLowerCase(), {
          mint: mintAddress,
          symbol: registered?.symbol || `${mintAddress.slice(0, 4)}…${mintAddress.slice(-4)}`,
          name: registered?.name || `Token ${mintAddress.slice(0, 6)}`,
          decimals,
          logoUri: registered?.logoUri || undefined,
          balance: uiAmt,
          rawBalance: rawAmt,
          priceUsd: price,
          valueUsd,
          change24h: registered?.priceChange24h,
          allocationPct: 0,
          isNativeCook: false,
        });
      }
    } catch {
      // skip unparseable account
    }
  }

  const holdingsList = Array.from(holdingsMap.values());
  const totalValueUsd = holdingsList.reduce((sum, h) => sum + h.valueUsd, 0);
  const tokensValueUsd = holdingsList
    .filter((h) => !h.isNativeCook)
    .reduce((sum, h) => sum + h.valueUsd, 0);

  // Compute allocation percentage & estimated 24h value delta
  let weightedChangeUsd = 0;
  for (const h of holdingsList) {
    h.allocationPct = totalValueUsd > 0 ? (h.valueUsd / totalValueUsd) * 100 : 0;
    if (h.change24h !== undefined && h.valueUsd > 0) {
      weightedChangeUsd += h.valueUsd * (h.change24h / 100);
    }
  }

  const change24hPct = totalValueUsd > 0 ? (weightedChangeUsd / totalValueUsd) * 100 : 0;

  // Sort: highest USD value first
  holdingsList.sort((a, b) => {
    if (b.valueUsd !== a.valueUsd) return b.valueUsd - a.valueUsd;
    return b.balance - a.balance;
  });

  return {
    totalValueUsd,
    cookBalance,
    cookValueUsd,
    tokensValueUsd,
    change24hUsd: weightedChangeUsd,
    change24hPct,
    holdings: holdingsList,
    assetCount: holdingsList.length,
  };
}

/**
 * Fetches recent confirmed on-chain transactions for the connected wallet address.
 * Queries RPC getSignaturesForAddress directly so it ONLY returns transactions
 * that this specific wallet participated in (not global validator vote transactions).
 */
export async function fetchWalletTransactions(
  ownerAddress: string,
  limit = 25
): Promise<WalletTransaction[]> {
  try {
    const conn = getConnection();
    const ownerPubkey = new PublicKey(ownerAddress);

    const sigs = await conn
      .getSignaturesForAddress(ownerPubkey, { limit })
      .catch(() => []);

    if (sigs.length === 0) {
      return [];
    }

    return sigs.map((s) => ({
      signature: s.signature,
      slot: s.slot,
      status: s.err ? "failed" : "success",
      timestamp: s.blockTime || Math.floor(Date.now() / 1000),
      type: s.memo ? "MEMO" : "TRANSACTION",
      instructionsCount: 1,
    }));
  } catch (err) {
    console.error("Failed to fetch wallet transactions:", err);
    return [];
  }
}
