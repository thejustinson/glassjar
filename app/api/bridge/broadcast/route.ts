import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";

export const runtime = "nodejs";

const SOLANA_RPCS = [
  process.env.SOLANA_MAINNET_RPC,
  process.env.NEXT_PUBLIC_SOLANA_RPC,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

const COOKIE_RPC = process.env.NEXT_PUBLIC_COOKIE_RPC || "https://rpc.cookiescan.io";

export async function POST(req: NextRequest) {
  try {
    const { rawTxBase64, chain } = await req.json();
    if (!rawTxBase64) {
      return NextResponse.json({ error: "Missing rawTxBase64" }, { status: 400 });
    }

    const txBuffer = Buffer.from(rawTxBase64, "base64");

    if (chain === "cookie") {
      const conn = new Connection(COOKIE_RPC, "confirmed");
      const txHash = await conn.sendRawTransaction(txBuffer, {
        skipPreflight: false,
        maxRetries: 3,
      });
      return NextResponse.json({ txHash }, { status: 200 });
    } else {
      // Solana mainnet
      for (const rpc of SOLANA_RPCS) {
        try {
          const conn = new Connection(rpc, "confirmed");
          const txHash = await conn.sendRawTransaction(txBuffer, {
            skipPreflight: false,
            maxRetries: 3,
          });
          return NextResponse.json({ txHash }, { status: 200 });
        } catch (e: any) {
          // If transaction simulation error, surface immediately
          if (e?.message?.includes("Transaction simulation failed") || e?.message?.includes("custom program error")) {
            return NextResponse.json({ error: e.message }, { status: 400 });
          }
        }
      }
      return NextResponse.json(
        { error: "Failed to broadcast transaction to Solana network. Please try again." },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to broadcast transaction" },
      { status: 500 }
    );
  }
}
