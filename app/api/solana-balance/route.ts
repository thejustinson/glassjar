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
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const SOLANA_RPCS = [
  process.env.SOLANA_MAINNET_RPC,
  process.env.NEXT_PUBLIC_SOLANA_RPC,
  "https://api.mainnet-beta.solana.com",
].filter(Boolean) as string[];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const targetMint = searchParams.get("mint") || SOLANA_WARP_MINT;

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

  // Handle native SOL
  const isNativeSol = targetMint === "So11111111111111111111111111111111111111112";

  let mint: PublicKey;
  try {
    mint = new PublicKey(targetMint);
  } catch {
    return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  }

  // Derive ATAs for both standard SPL and Token-2022
  const isWarpCook = targetMint === SOLANA_WARP_MINT;
  const [standardAta] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const [token2022Ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const primaryAta = isWarpCook ? token2022Ata : standardAta;
  const fallbackAta = isWarpCook ? standardAta : token2022Ata;

  for (const rpc of SOLANA_RPCS) {
    try {
      // 1. Query native SOL balance
      let solBalance = 0;
      try {
        const solRes = await fetch(rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 99,
            method: "getBalance",
            params: [owner.toBase58()],
          }),
          signal: AbortSignal.timeout(4000),
        });
        if (solRes.ok) {
          const solData = await solRes.json();
          solBalance = (solData.result?.value ?? 0) / 1e9;
        }
      } catch {
        // ignore
      }

      if (isNativeSol) {
        return NextResponse.json(
          {
            success: true,
            balance: solBalance,
            decimals: 9,
            solBalance,
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

      // 2. Query primary ATA
      let tokenRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountBalance",
          params: [primaryAta.toBase58()],
        }),
        signal: AbortSignal.timeout(6000),
      });

      let tokenData = tokenRes.ok ? await tokenRes.json() : null;
      if (!tokenData?.result?.value && primaryAta.toBase58() !== fallbackAta.toBase58()) {
        // Try fallback ATA (e.g. Token-2022)
        try {
          const fbRes = await fetch(rpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 2,
              method: "getTokenAccountBalance",
              params: [fallbackAta.toBase58()],
            }),
            signal: AbortSignal.timeout(5000),
          });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            if (fbData?.result?.value) {
              tokenData = fbData;
            }
          }
        } catch {
          // ignore
        }
      }

      if (tokenData?.result?.value?.uiAmount !== undefined) {
        return NextResponse.json(
          {
            success: true,
            balance: tokenData.result.value.uiAmount as number,
            amount: tokenData.result.value.amount as string,
            decimals: tokenData.result.value.decimals as number,
            ata: primaryAta.toBase58(),
            solBalance,
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

      // If token account not found/uninitialized, return 0 balance
      return NextResponse.json(
        {
          success: true,
          balance: 0,
          solBalance,
          ata: primaryAta.toBase58(),
        },
        { status: 200 }
      );
    } catch {
      // try next RPC
    }
  }

  // Fallback if RPCs fail
  return NextResponse.json(
    {
      success: true,
      balance: 0,
      solBalance: 0,
      ata: primaryAta.toBase58(),
    },
    { status: 200 }
  );
}
