import { NextRequest, NextResponse } from "next/server";

const COOKIE_SWAP_API_URL =
  process.env.NEXT_PUBLIC_COOKIE_SWAP_API_URL?.trim().replace(/\/$/, "") ??
  "https://swap.cookiescan.io/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { multiRoute, userPublicKey } = body;

    if (!multiRoute || !userPublicKey) {
      return NextResponse.json(
        { error: "Missing multiRoute or userPublicKey in request body." },
        { status: 400 }
      );
    }

    const res = await fetch(`${COOKIE_SWAP_API_URL}/swap-tx/multi-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ multiRoute, userPublicKey }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errJson;
      try {
        errJson = JSON.parse(errText);
      } catch {
        // text only
      }

      return NextResponse.json(
        {
          error:
            errJson?.error ||
            `Failed to build swap transaction (${res.status}): ${errText}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const txBase64 = data.transactionBase64 || data.transaction;

    if (!txBase64) {
      return NextResponse.json(
        { error: "No transaction payload returned from swap builder." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transaction: txBase64,
      transactionBase64: txBase64,
    });
  } catch (err: any) {
    console.error("[api/swap/build-tx] error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to build swap transaction" },
      { status: 500 }
    );
  }
}
