import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export const runtime = "nodejs";

const SOLANA_WARP_MINT = "36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1";
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
);

const SOLANA_RPCS = [
  process.env.SOLANA_MAINNET_RPC,
  process.env.NEXT_PUBLIC_SOLANA_RPC,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Address query parameter is required" },
      { status: 400 }
    );
  }

  let owner: PublicKey;
  try {
    owner = new PublicKey(address);
  } catch {
    return NextResponse.json(
      { error: "Invalid Solana address" },
      { status: 400 }
    );
  }

  const mint = new PublicKey(SOLANA_WARP_MINT);
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  for (const rpc of SOLANA_RPCS) {
    try {
      // 1. Direct query on the Token-2022 ATA
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountBalance",
          params: [ata.toBase58()],
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.result?.value?.uiAmount !== undefined) {
          return NextResponse.json(
            {
              success: true,
              balance: data.result.value.uiAmount as number,
              amount: data.result.value.amount as string,
              decimals: data.result.value.decimals as number,
              ata: ata.toBase58(),
            },
            {
              status: 200,
              headers: {
                "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        }
      }

      // 2. Fallback query: parsed token accounts by owner
      const resOwner = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "getTokenAccountsByOwner",
          params: [
            owner.toBase58(),
            { programId: TOKEN_2022_PROGRAM_ID.toBase58() },
            { encoding: "jsonParsed" },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (resOwner.ok) {
        const dataOwner = await resOwner.json();
        let total = 0;
        const accounts = dataOwner.result?.value || [];
        for (const acc of accounts) {
          if (acc.account?.data?.parsed?.info?.mint === SOLANA_WARP_MINT) {
            total += acc.account.data.parsed.info.tokenAmount.uiAmount || 0;
          }
        }
        return NextResponse.json(
          {
            success: true,
            balance: total,
            ata: ata.toBase58(),
            decimals: 6,
          },
          {
            status: 200,
            headers: {
              "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    } catch {
      // Try next RPC
    }
  }

  // If all attempts failed or returned no accounts, return 0 safely
  return NextResponse.json(
    {
      success: true,
      balance: 0,
      ata: ata.toBase58(),
      decimals: 6,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
