import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const IPFS_GATEWAYS = [
  "https://ipfs.filebase.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://flk-ipfs.xyz/ipfs/",
  "https://ipfs.io/ipfs/",
];

function extractIpfsPath(url: string): string | null {
  if (url.startsWith("ipfs://")) return url.slice(7);
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#\s]*)?)/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");
  const ipfsParam = searchParams.get("ipfs");

  const targetPath = ipfsParam || (rawUrl ? extractIpfsPath(rawUrl) : null);

  // If it is an IPFS asset, cycle through gateways
  if (targetPath) {
    for (const gw of IPFS_GATEWAYS) {
      const fullUrl = `${gw}${targetPath}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(fullUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GlassJar/1.0",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });
        clearTimeout(timer);

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "image/png";
          const buffer = await res.arrayBuffer();

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      } catch {
        // Try next gateway
      }
    }
  }

  // If it's a direct non-IPFS URL, fetch and proxy it
  if (rawUrl && rawUrl.startsWith("http")) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(rawUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GlassJar/1.0",
          Accept: "image/*,*/*",
        },
      });
      clearTimeout(timer);

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "image/png";
        const buffer = await res.arrayBuffer();

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    } catch {
      // ignore
    }
  }

  return new NextResponse(null, { status: 404 });
}
