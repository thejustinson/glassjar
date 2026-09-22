import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { quoteResponse, userPublicKey, prioritizationFeeLamports } = body;

    if (!quoteResponse || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing quoteResponse or userPublicKey in request body" },
        { status: 400 }
      );
    }

    const swapUrl = "https://api.jup.ag/swap/v1/swap";

    const res = await fetch(swapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "GlassJar/1.0",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: prioritizationFeeLamports || "auto",
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Jupiter swap build returned status ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error building Solana swap transaction" },
      { status: 500 }
    );
  }
}
