/**
 * app/api/faucet/route.ts
 * Server-side COOK faucet endpoint.
 * Sends a small amount of native COOK to the requesting wallet on Cookie Chain.
 *
 * - Rate limited: 1 claim per wallet per 24h (persisted in Supabase)
 * - Whitelist bypass via FAUCET_WHITELIST_ADDRESS env var
 * - Payout: USD-equivalent range, weighted toward lower end (cubic distribution)
 * - Private key never leaves the server
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "@/lib/chain";
import { getCookPrice } from "@/lib/das";
import {
  checkFaucetEligibility,
  recordFaucetClaim,
} from "@/lib/supabase";

export const runtime = "nodejs";

const COOKIE_RPC = process.env.NEXT_PUBLIC_COOKIE_RPC ?? "https://rpc.cookiescan.io";

const MIN_USD = 0.30;
const MAX_USD = 2.00;
const COOK_DECIMALS = 9;

function decodeBase58(raw: string): Uint8Array {
  const fn = (bs58 as any).decode || (bs58 as any).default?.decode;
  if (typeof fn !== "function") {
    throw new Error("bs58 decode function not available");
  }
  return fn(raw);
}

function getPayerKeypair(): Keypair | null {
  const raw = process.env.FAUCET_PAYER_PRIVATE_KEY;
  if (!raw) return null;
  try {
    // Support both base58 and JSON array formats
    if (raw.startsWith("[")) {
      const arr = JSON.parse(raw) as number[];
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(decodeBase58(raw));
  } catch (e) {
    console.error("[Faucet] Invalid FAUCET_PAYER_PRIVATE_KEY format:", e);
    return null;
  }
}

function isWhitelisted(address: string): boolean {
  const whitelist = process.env.FAUCET_WHITELIST_ADDRESS;
  if (!whitelist) return false;
  return whitelist.split(",").map((a) => a.trim()).includes(address);
}

/**
 * Generate a random USD amount weighted toward the lower end.
 * Uses cubic distribution: most payouts cluster near MIN_USD.
 */
function generatePayoutUsd(): number {
  const r = Math.pow(Math.random(), 3);
  return MIN_USD + r * (MAX_USD - MIN_USD);
}

function isValidBase58PublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse and validate request
    const body = await req.json().catch(() => null);
    const walletAddress = body?.walletAddress;

    if (!walletAddress || typeof walletAddress !== "string") {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    if (!isValidBase58PublicKey(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // 2. Check payer keypair is configured
    const payer = getPayerKeypair();
    if (!payer) {
      return NextResponse.json(
        { error: "Faucet is unavailable, please try again." },
        { status: 503 }
      );
    }

    // 3. Rate limit check (skip for whitelisted addresses)
    if (!isWhitelisted(walletAddress)) {
      const eligibility = await checkFaucetEligibility(walletAddress);
      if (!eligibility.eligible) {
        return NextResponse.json(
          {
            error: "Already claimed today",
            nextEligibleAt: eligibility.nextEligibleAt,
            lastClaim: eligibility.lastClaim
              ? {
                  amountUsd: eligibility.lastClaim.amount_usd,
                  txSignature: eligibility.lastClaim.tx_signature,
                  claimedAt: eligibility.lastClaim.created_at,
                }
              : undefined,
          },
          { status: 429 }
        );
      }
    }

    // 4. Fetch COOK price for USD conversion
    const cookPrice = await getCookPrice();
    if (!cookPrice || cookPrice <= 0) {
      return NextResponse.json(
        { error: "Faucet is unavailable, please try again." },
        { status: 503 }
      );
    }

    // 5. Calculate payout
    const payoutUsd = generatePayoutUsd();
    const cookAmount = payoutUsd / cookPrice;
    const lamports = Math.floor(cookAmount * Math.pow(10, COOK_DECIMALS));

    if (lamports <= 0) {
      return NextResponse.json(
        { error: "Faucet is unavailable, please try again." },
        { status: 500 }
      );
    }

    // 6. Check payer balance
    const connection = getConnection();
    const payerBalance = await connection.getBalance(payer.publicKey);

    // Need lamports for transfer + rent/fees (~5000 lamports buffer)
    if (payerBalance < lamports + 10000) {
      return NextResponse.json(
        { error: "Faucet is unavailable, please try again." },
        { status: 503 }
      );
    }

    // 7. Build, sign, and broadcast transaction via HTTP
    const recipient = new PublicKey(walletAddress);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({
      feePayer: payer.publicKey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports,
      })
    );
    tx.sign(payer);

    const rawTx = tx.serialize();
    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log("[Faucet] Transaction broadcast:", signature);

    // 8. Record claim in Supabase immediately
    try {
      await recordFaucetClaim(
        walletAddress,
        lamports,
        payoutUsd,
        cookPrice,
        signature
      );
    } catch (dbErr: any) {
      console.error("[Faucet] Failed to save claim to Supabase:", dbErr);
    }

    // 9. Confirm transaction via HTTP polling (no WebSocket dependency)
    const pollStart = Date.now();
    while (Date.now() - pollStart < 10000) {
      try {
        const statuses = await connection.getSignatureStatuses([signature], {
          searchTransactionHistory: true,
        });
        const status = statuses?.value?.[0];
        if (
          status?.confirmationStatus === "confirmed" ||
          status?.confirmationStatus === "finalized"
        ) {
          break;
        }
        if (status?.err) {
          console.error("[Faucet] On-chain error:", status.err);
          break;
        }
      } catch {
        // ignore polling error and retry
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 10. Return success
    return NextResponse.json({
      success: true,
      txSignature: signature,
      amountCook: cookAmount,
      amountUsd: payoutUsd,
      cookPrice,
      lamports,
    });
  } catch (err: any) {
    console.error("[Faucet] Error:", err);
    return NextResponse.json(
      { error: "Faucet is unavailable, please try again." },
      { status: 500 }
    );
  }
}
