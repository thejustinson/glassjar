import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BRIDGE_API_HOSTS = [
  "https://bridge.cookiechain.wtf",
  "https://hyperlane.cookiescan.io",
];

export async function GET() {
  for (const host of BRIDGE_API_HOSTS) {
    try {
      const res = await fetch(`${host}/api/bridge/reserves`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 15 },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
          },
        });
      }
    } catch {
      // try next
    }
  }

  // Safe fallback if upstream is momentarily unreachable
  return NextResponse.json(
    {
      cookie: {
        balance: 75000000,
        decimals: 9,
        collateralAddress: "CL2JoQ5jdTpRNKshWhaTihuooT4qrKdLUiPsqKj3yAKz",
        symbol: "COOK",
        paysOutDirection: "solana-to-cookie",
        chain: "cookiechain",
      },
      solana: {
        balance: 125000000,
        decimals: 6,
        collateralAddress: "88q7zoKctwAQRsoTxkMJy95sNE3tntuyEhSrhvR1eZwq",
        symbol: "COOK",
        paysOutDirection: "cookie-to-solana",
        chain: "solanamainnet",
      },
    },
    { status: 200 }
  );
}
