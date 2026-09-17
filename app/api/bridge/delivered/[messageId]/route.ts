import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const BRIDGE_API_HOSTS = [
  "https://bridge.cookiechain.wtf",
  "https://hyperlane.cookiescan.io",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const { searchParams } = new URL(req.url);
  const dest = searchParams.get("dest") || "cookie";

  if (!messageId) {
    return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
  }

  for (const host of BRIDGE_API_HOSTS) {
    try {
      const url = `${host}/api/bridge/delivered/${encodeURIComponent(messageId)}?dest=${encodeURIComponent(dest)}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, { status: 200 });
      }
    } catch {
      // try next
    }
  }

  return NextResponse.json(
    { delivered: false, error: "Status check pending" },
    { status: 200 }
  );
}
