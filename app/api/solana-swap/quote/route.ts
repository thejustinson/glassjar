import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const COOK_SOLANA_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inputMint = searchParams.get("inputMint") || SOL_MINT;
    const outputMint = searchParams.get("outputMint") || COOK_SOLANA_MINT;
    const amountStr = searchParams.get("amount"); // base units (lamports, etc.)
    const slippageBps = searchParams.get("slippageBps") || "100"; // default 1%

    if (!amountStr || Number(amountStr) <= 0) {
      return NextResponse.json({ error: "Missing or invalid amount parameter" }, { status: 400 });
    }

    const jupUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${encodeURIComponent(
      inputMint
    )}&outputMint=${encodeURIComponent(
      outputMint
    )}&amount=${encodeURIComponent(amountStr)}&slippageBps=${encodeURIComponent(slippageBps)}`;

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
