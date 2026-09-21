"use client";

/**
 * components/wallet/WalletProvider.tsx
 * Client-side wallet context — wraps the whole app.
 * Uses Wallet Standard auto-detect (wallets=[]) so Nightly, Phantom,
 * Solflare etc. all appear automatically if the extension is installed.
 *
 * DO NOT use clusterApiUrl() here — that hits Solana mainnet.
 * The endpoint MUST point at Cookie Chain RPC.
 */

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { NightlyWalletAdapter } from "@solana/wallet-adapter-nightly";

// Default wallet-adapter styles (modal backdrop, wallet list, etc.)
// We override the accent colors in globals.css below
import "@solana/wallet-adapter-react-ui/styles.css";

const COOKIE_RPC =
  process.env.NEXT_PUBLIC_COOKIE_RPC ?? "https://rpc.cookiescan.io";

export function AppWalletProvider({ children }: { children: React.ReactNode }) {
  // Explicit Nightly adapter ensures Nightly is always registered and detected
  // alongside any auto-discovered Wallet Standard wallets (Phantom, Backpack, Solflare...).
  const wallets = useMemo(() => [
    new NightlyWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider
      endpoint={COOKIE_RPC}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
