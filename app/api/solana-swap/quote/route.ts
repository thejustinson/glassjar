import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const COOK_SOLANA_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const amountStr = searchParams.get("amount"); // lamports of SOL
    const slippageBps = searchParams.get("slippageBps") || "100"; // default 1%

    if (!amountStr || Number(amountStr) <= 0) {
      return NextResponse.json({ error: "Missing or invalid amount parameter" }, { status: 400 });
    }

    const jupUrl = `https://public.jupiterapi.com/quote?inputMint=${SOL_MINT}&outputMint=${COOK_SOLANA_MINT}&amount=${amountStr}&slippageBps=${slippageBps}`;

    const res = await fetch(jupUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "GlassJar/1.0",
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Jupiter quote returned status ${res.status}: ${errText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error fetching Solana swap quote" },
      { status: 500 }
    );
  }
}
