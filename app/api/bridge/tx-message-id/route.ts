import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { extractHyperlaneMessageId } from "@/lib/bridge";

export const runtime = "nodejs";

const SOLANA_RPCS = [
  process.env.SOLANA_MAINNET_RPC,
  process.env.NEXT_PUBLIC_SOLANA_RPC,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

const COOKIE_RPC = process.env.NEXT_PUBLIC_COOKIE_RPC || "https://rpc.cookiescan.io";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const txHash = searchParams.get("txHash");
  const chain = searchParams.get("chain") || "solana";

  if (!txHash) {
    return NextResponse.json({ error: "Missing txHash parameter" }, { status: 400 });
  }

  const rpcs = chain === "cookie" ? [COOKIE_RPC] : SOLANA_RPCS;

  for (const rpc of rpcs) {
    try {
      const conn = new Connection(rpc, "confirmed");
      const tx = await conn.getTransaction(txHash, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (tx?.meta?.logMessages) {
        const messageId = extractHyperlaneMessageId(tx.meta.logMessages);
        if (messageId) {
          return NextResponse.json({ success: true, messageId, txHash }, { status: 200 });
        }
      }
    } catch {
      // try next RPC
    }
  }

  return NextResponse.json(
    { success: false, error: "Message ID not yet found in transaction logs" },
    { status: 404 }
  );
}
