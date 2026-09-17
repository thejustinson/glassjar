import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BRIDGE_API_HOSTS = [
  "https://bridge.cookiechain.wtf",
  "https://hyperlane.cookiescan.io",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { direction, fromAddress, toAddress, amount } = body;

    if (!direction || !fromAddress || !toAddress || !amount) {
      return NextResponse.json(
        { error: "Missing required bridge parameters" },
        { status: 400 }
      );
    }

    for (const host of BRIDGE_API_HOSTS) {
      try {
        const res = await fetch(`${host}/api/bridge/build-tx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            direction,
            fromAddress,
            toAddress,
            amount: amount.toString().trim(),
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = await res.json();
          return NextResponse.json(data, { status: 200 });
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || `Upstream bridge returned ${res.status}`;
          return NextResponse.json({ error: errMsg }, { status: res.status });
        }
      } catch {
        // Try next host
      }
    }

    return NextResponse.json(
      { error: "Unable to reach bridge coordinator. Please try again shortly." },
      { status: 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
