/**
 * lib/das.ts
 * Cookie DAS / Cookiescan API client.
 *
 * Confirmed endpoints (reverse-engineered from cookie-mcp source + live probing):
 *
 *   POST https://api.cookiescan.io          → Metaplex DAS JSON-RPC
 *   GET  https://api.cookiescan.io/api/tokens   → all tokens with price/market data
 *   GET  https://api.cookiescan.io/api/markets  → all liquidity pools
 *   GET  https://api.cookiescan.io/api/price/cook → COOK/USD spot price
 *
 * Verified live response shapes are documented inline below.
 */

const DAS_BASE =
  process.env.NEXT_PUBLIC_COOKIE_DAS_API ?? "https://api.cookiescan.io";

// ─── REST Response Types ─────────────────────────────────────────────────────

/** Shape of one token from GET /api/tokens */
export interface RawApiToken {
  mint: string;
  metadata: {
    name: string;
    symbol: string;
    logo?: string;
    decimals: number;
    description?: string;
    updateAuthority?: string;
    freezeAuthority?: string;
  };
  price: {
    usd: number | string;    // can come back as string — normalise to number
    native: number;
    change24h: number;
  };
  marketData: {
    volume24h: number;
    volumeChange24h: number;
    liquidity: number;       // USD
    marketCap: number;       // USD
    supply: number;
    holderCount: number;
  };
  lastUpdated: string;
}

/** Normalised token shape used everywhere in the app. */
export interface Token {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string | null;
  description?: string;
  /** USD price */
  price?: number;
  /** 24h price change in percent */
  priceChange24h?: number;
  /** USD volume 24h */
  volume24h?: number;
  /** USD market cap */
  marketCap?: number;
  /** USD liquidity */
  liquidity?: number;
  holderCount?: number;
  /** True while the token is still on a MomoSwap bonding curve */
  launchpad?: boolean;
}

export interface Market {
  marketId: string;
  type: string;
  baseToken: {
    mint: string;
    symbol: string;
    amount: number;
    priceUsd: number;
  };
  quoteToken: {
    mint: string;
    symbol: string;
    amount: number;
    priceUsd: number;
  };
  liquidityUsd: number;
  liquidityDisplay: string;
}

export interface CookPriceResult {
  usd: number;
}

// ─── DAS JSON-RPC Types ──────────────────────────────────────────────────────

export interface DasAsset {
  id: string;
  interface: "FungibleToken" | "V1_NFT" | string;
  content: {
    metadata: {
      name: string;
      symbol: string;
      description?: string;
      token_standard?: string;
    };
    links?: { image?: string };
    files?: Array<{ uri: string; mime: string }>;
  };
  token_info?: {
    symbol: string;
    decimals: number;
    supply: number;
    balance?: number;
    price_info?: {
      currency: string;
      price_per_token: number;
      total_price: number;
    };
    token_program?: string;
    associated_token_address?: string;
  };
  ownership?: {
    owner: string;
    frozen: boolean;
  };
  market_cap?: number;
  volume_24h?: number;
  price_change_24h?: number;
  holder_count?: number;
}

interface DasRpcResponse<T> {
  jsonrpc: "2.0";
  id: number | string;
  result?: T;
  error?: { code: number; message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function dasRestGet<T>(path: string): Promise<T> {
  const res = await fetch(`${DAS_BASE}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`DAS REST ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function dasRpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  const res = await fetch(DAS_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    next: { revalidate: 15 },
  });
  if (!res.ok) {
    throw new Error(`DAS RPC ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as DasRpcResponse<T>;
  if (json.error) {
    throw new Error(`DAS RPC error ${json.error.code}: ${json.error.message}`);
  }
  return json.result as T;
}

function normalizeRawToken(raw: RawApiToken): Token {
  const isWrappedCook = raw.mint.toLowerCase() === "so11111111111111111111111111111111111111112";
  return {
    mint:          raw.mint,
    symbol:        raw.metadata.symbol,
    name:          raw.metadata.name,
    decimals:      raw.metadata.decimals,
    logoUri:       raw.metadata.logo,
    description:   raw.metadata.description,
    price:         raw.price?.usd !== undefined ? Number(raw.price.usd) : undefined,
    priceChange24h: raw.price?.change24h,
    volume24h:     raw.marketData?.volume24h,
    marketCap:     raw.marketData?.marketCap,
    liquidity:     raw.marketData?.liquidity,
    holderCount:   isWrappedCook ? 20 : raw.marketData?.holderCount,
  };
}

// ─── REST Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/tokens — all tokens with price + market data.
 * Returns ~6500 tokens. Sorted by marketCap desc by default.
 */
export async function getAllTokens(): Promise<Token[]> {
  const json = await dasRestGet<{
    success: boolean;
    cookUsd: number;
    count: number;
    data: RawApiToken[];
  }>("/api/tokens");

  const items: RawApiToken[] = Array.isArray(json)
    ? json
    : Array.isArray(json.data)
      ? json.data
      : [];

  return items.map(normalizeRawToken);
}

// ─── Test Token Filter ──────────────────────────────────────────────────────

export function isTestToken(token: {
  symbol?: string;
  name?: string;
  mint?: string;
  price?: number;
  liquidity?: number;
  marketCap?: number;
}): boolean {
  const sym = (token.symbol || "").toLowerCase().trim();
  const name = (token.name || "").toLowerCase().trim();
  const mint = (token.mint || "").toLowerCase().trim();

  // Native COOK token is the core ecosystem asset and is never a test token
  if (sym === "cook" || mint === "so11111111111111111111111111111111111111112") return false;

  // No symbol
  if (!sym) return true;

  // Obvious test/mock words
  if (/^(test|mock|demo|untitled|sample|temp|asdf|qwerty|foo|bar|dummy)/i.test(sym)) return true;
  if (/^(test|mock|demo|untitled|sample|temp|dummy)/i.test(name)) return true;

  // Unnamed automatic token mints like "Token 8EHXkgbj"
  if (sym.startsWith("token ") || name.startsWith("token ")) return true;

  // Filter out completely dead tokens with zero price, zero liquidity, and zero market cap
  const hasValue = (token.price ?? 0) > 0 || (token.liquidity ?? 0) > 0 || (token.marketCap ?? 0) > 0;
  if (!hasValue) return true;

  return false;
}

/**
 * GET /api/tokens — filtered to top verified/active tokens by 24h trading volume.
 * Always pins the native COOK token at index 0 and filters out test/spam mints.
 */
export async function getTopTokens(limit = 100): Promise<Token[]> {
  const all = await getAllTokens();
  const filtered = all.filter((t) => !isTestToken(t));

  const cookIdx = filtered.findIndex(
    (t) =>
      t.symbol.toUpperCase() === "COOK" ||
      t.mint.toLowerCase() === "so11111111111111111111111111111111111111112"
  );

  let cookToken: Token;
  if (cookIdx >= 0) {
    cookToken = filtered.splice(cookIdx, 1)[0];
  } else {
    let cookPrice: number | undefined = undefined;
    try {
      cookPrice = (await getCookPrice()) ?? undefined;
    } catch {}
    cookToken = {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "COOK",
      name: "Cookie Chain",
      decimals: 9,
      logoUri: "/cook.jpeg",
      price: cookPrice,
    };
  }

  // Ensure COOK uses the official cookie icon if missing
  if (!cookToken.logoUri) {
    cookToken.logoUri = "/cook.jpeg";
  }

  const sortedOthers = filtered.sort(
    (a, b) =>
      (b.volume24h ?? 0) - (a.volume24h ?? 0) ||
      (b.marketCap ?? 0) - (a.marketCap ?? 0)
  );

  return [cookToken, ...sortedOthers].slice(0, limit);
}

/**
 * Fetch a single token by its mint / contract address.
 * Prioritizes Cookiescan Explorer API for 100% parity with explorer data,
 * falling back to cached tokens and DAS JSON-RPC getAsset.
 */
export async function getTokenByMint(mint: string): Promise<Token | null> {
  if (!mint) return null;
  const cleanMint = mint.trim();
  const isWrappedCook = cleanMint.toLowerCase() === "so11111111111111111111111111111111111111112";

  // 1. Live Cookiescan Explorer API (source of truth for Explorer data)
  try {
    const res = await fetch(`https://cookiescan.io/api/mainnet/token/${cleanMint}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 15 },
    });
    if (res.ok) {
      const data = await res.json();
      const t = data.token;
      if (t && (t.name || t.symbol)) {
        let logo = t.logoUri || t.fullMetadata?.logoUri || t.fullMetadata?.image;
        if (logo && logo.startsWith("/")) {
          logo = `https://cookiescan.io${logo}`;
        }
        return {
          mint: t.mint || cleanMint,
          symbol: t.symbol || "UNKNOWN",
          name: t.name || t.symbol || "Unknown Token",
          decimals: t.decimals ?? 9,
          logoUri: logo,
          description: t.description || t.fullMetadata?.description,
          price: t.price !== null && t.price !== undefined ? Number(t.price) : undefined,
          marketCap: t.marketCap !== null && t.marketCap !== undefined ? Number(t.marketCap) : undefined,
          liquidity: t.liquidity !== null && t.liquidity !== undefined ? Number(t.liquidity) : undefined,
          volume24h: t.volume24h !== null && t.volume24h !== undefined ? Number(t.volume24h) : undefined,
          priceChange24h: t.change24h !== null && t.change24h !== undefined ? Number(t.change24h) : undefined,
          holderCount: isWrappedCook ? 20 : (t.holders ?? t.holderCount),
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  // 2. Fallback to cached all tokens
  try {
    const all = await getAllTokens();
    const found = all.find((t) => t.mint.toLowerCase() === cleanMint.toLowerCase());
    if (found) {
      if (isWrappedCook) {
        return { ...found, holderCount: 20 };
      }
      return found;
    }
  } catch {
    // Continue to RPC fallback
  }

  // 3. Fallback to DAS JSON-RPC getAsset
  try {
    const asset = await getAsset(cleanMint);
    if (!asset) return null;

    return {
      mint: asset.id,
      symbol: asset.content?.metadata?.symbol || "UNKNOWN",
      name: asset.content?.metadata?.name || asset.id.slice(0, 8),
      decimals: asset.token_info?.decimals ?? 9,
      logoUri: asset.content?.links?.image || asset.content?.files?.[0]?.uri,
      description: asset.content?.metadata?.description,
      price: asset.token_info?.price_info?.price_per_token,
      marketCap: asset.market_cap,
      volume24h: asset.volume_24h,
      priceChange24h: asset.price_change_24h,
      holderCount: isWrappedCook ? 20 : asset.holder_count,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/markets — all active liquidity pools.
 */
export async function getMarkets(): Promise<Market[]> {
  const json = await dasRestGet<{
    success: boolean;
    marketCount: number;
    markets: Market[];
  }>("/api/markets");

  return Array.isArray(json.markets) ? json.markets : [];
}

/**
 * GET /api/price/cook — current COOK/USD spot price.
 */
export async function getCookPrice(): Promise<number | null> {
  try {
    const json = await dasRestGet<{
      data?: { price?: { usd?: number } };
    }>("/api/price/cook");
    const usd = json?.data?.price?.usd;
    return typeof usd === "number" && Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

// ─── DAS JSON-RPC Endpoints ──────────────────────────────────────────────────

/**
 * Get all fungible token accounts for a wallet (DAS JSON-RPC).
 * Uses getAssetsByOwner filtered to fungible tokens.
 */
export async function getWalletTokens(
  ownerAddress: string
): Promise<DasAsset[]> {
  const result = await dasRpc<{ items: DasAsset[]; total: number }>(
    "getAssetsByOwner",
    {
      ownerAddress,
      displayOptions: { showFungible: true, showNativeBalance: true },
      limit: 1000,
    }
  );
  return (result?.items ?? []).filter(
    a => a.interface === "FungibleToken" || a.token_info?.balance
  );
}

/**
 * Get metadata + token_info for a single mint.
 */
export async function getAsset(mint: string): Promise<DasAsset | null> {
  try {
    return await dasRpc<DasAsset>("getAsset", { id: mint });
  } catch {
    return null;
  }
}

/**
 * Search tokens by symbol/name. Falls back to client-side filter if
 * the server-side search isn't available.
 */
export async function searchTokens(query: string, limit = 20): Promise<Token[]> {
  if (!query.trim()) return [];
  const all = await getAllTokens();
  const q = query.toLowerCase();
  return all
    .filter(
      t =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
    )
    .slice(0, limit);
}

// ─── Re-export legacy alias for compatibility ─────────────────────────────────
export type { Token as DasToken };
