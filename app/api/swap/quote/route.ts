import { NextRequest, NextResponse } from "next/server";

const COOKIE_SWAP_API_URL =
  process.env.NEXT_PUBLIC_COOKIE_SWAP_API_URL?.trim().replace(/\/$/, "") ??
  "https://swap.cookiescan.io/api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const slippageBps = searchParams.get("slippageBps") ?? "100";

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "Missing required parameters: inputMint, outputMint, amount" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
    });

    const res = await fetch(`${COOKIE_SWAP_API_URL}/quote/multi-route?${params}`, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      let errJson;
      try {
        errJson = JSON.parse(errText);
      } catch {
        // text only
      }

      const errorMessage =
        errJson?.error ||
        (res.status === 404
          ? "No swap route available for this token pair."
          : `Quote failed (${res.status}): ${errText}`);

      return NextResponse.json(
        { error: errorMessage, noRoute: Boolean(errJson?.noRoute || res.status === 404) },
        { status: res.status }
      );
    }

    const data = await res.json();
    const multiRoute = data.multiRoute;

    if (!multiRoute) {
      return NextResponse.json(
        { error: "No swap route found for this amount." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      inputMint,
      outputMint,
      inAmount: multiRoute.totalInAmount ?? amount,
      outAmount: multiRoute.totalOutAmount ?? "0",
      otherAmountThreshold: multiRoute.minOutAmount ?? "0",
      slippageBps: Number(slippageBps),
      priceImpactPct: multiRoute.combinedPriceImpactPct ?? 0,
      protocolFeeAmount: multiRoute.protocolFeeAmount,
      programName: multiRoute.programName,
      route: multiRoute,
      _source: "cookiescan",
    });
  } catch (err: any) {
    console.error("[api/swap/quote] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch swap quote" },
      { status: 500 }
    );
  }
}
