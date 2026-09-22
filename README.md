<div align="center">

# 🍯 GlassJar (`glassjar.fun`)

**The Premier Trading Terminal, DEX Aggregator & Bridge for Cookie Chain**

[![Cookie Chain](https://img.shields.io/badge/Network-Cookie%20Chain%20Mainnet-F5A623?style=for-the-badge&logo=cookie&logoColor=white)](https://cookiescan.io)
[![Next.js 16](https://img.shields.io/badge/Next.js-16%20(Turbopack)-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hyperlane](https://img.shields.io/badge/Bridge-Hyperlane%20Warp%20Route-8A2BE2?style=for-the-badge)](https://hyperlane.xyz)
[![Jupiter](https://img.shields.io/badge/Zap%20Engine-Jupiter%20v1-orange?style=for-the-badge)](https://jup.ag)

[Live App](https://glassjar.fun) • [Explorer](https://cookiescan.io) • [Docs](https://docs.cookiechain.wtf) • [Bridge](https://bridge.cookiechain.wtf) • [Community](https://t.me/glassjardotfun)

---

</div>

## 📌 Overview

**GlassJar** is a high-performance trading terminal and decentralized liquidity hub built for **Cookie Chain** — an independent, high-throughput SVM-compatible Layer 1 blockchain (genesis hash: `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`).

Engineered for the Superteam Earn bounty **"Create an App on Cookie Chain,"** GlassJar delivers an institutional-grade trading experience inspired by terminals like Birdeye and Jupiter, while remaining strictly non-custodial and 100% on-chain.

### 🌟 Core Guarantees
- **Real Transactions Only**: Zero mock data or fabricated success states. Every quote, swap, launch, and bridge transfer interacts directly with live on-chain programs and RPC endpoints.
- **Strict Non-Custodial Security**: No private keys or seed phrases ever touch the application server. All transactions are signed client-side via standard Solana/SVM wallet adapters (**Nightly**, **Phantom**, **Solflare**).
- **Cluster Isolation**: On app boot, GlassJar validates the connected RPC's genesis hash against Cookie Chain mainnet to eliminate accidental collisions with Solana mainnet.

---

## ⚡ Key Features

### 1. 🔍 Discover & Market Overview (`/`)
- **Real-Time Token Directory**: Live market metrics (price, 24h change, volume, liquidity, market cap) sourced directly from the Cookie DAS API (`https://api.cookiescan.io`).
- **Trending & Popular Tokens**: Dynamic filtering highlighting the most actively traded pairs on Cookie Chain, with prioritized indexing for native `$COOK`.
- **Instant Search & CA Resolver**: Search by token ticker or paste any base58 Contract Address for instant on-chain lookup.

### 2. 📊 Interactive Token Analytics (`/token/[mint]`)
- **Live Price Charts**: Real-time candlestick and line price charts powered by verified DEX pool trades.
- **Security Audit Cards**: Inspect token mint authority, freeze authority status, and pool liquidity depth.
- **Recent Trades Feed**: Real-time streaming transaction ledger for any selected token on Cookie Chain with direct explorer links.

### 3. 🔄 Cookieswap Swap Terminal (`/swap`)
- **Direct DEX Execution**: Routes swaps through native Cookie Chain AMMs and concentrated liquidity pools (Cookieswap BAMM / Raydium-CLMM fork, Candy Shop, and Cookiebox).
- **Preflight Simulation**: Simulates transactions on-chain before prompting the user's wallet to sign, preventing failed transactions and wasted gas.
- **Comprehensive Slippage & Route Control**: Custom slippage tolerance (0.1% – 5%), price impact warning thresholds, and multi-hop route inspection.
- **Real Confirmation Handling**: Live status tracking from `pending` $\to$ `confirmed` with full error diagnostics for rejected signatures, insufficient balance, or slippage limits.

### 4. ⚡ Hyperlane Warp Route & Solana Zap Bridge (`/bridge`)
- **Direct 1:1 Bridge**: Move COOK seamlessly between Solana Mainnet (Token-2022, 6 decimals) and Cookie Chain (Native COOK, 9 decimals) across the official Hyperlane Warp Route.
- **Zap Bridge (Any Solana SPL $\to$ Cookie Chain COOK)**:
  - Connect a Solana wallet and select **SOL, USDC, USDT, JUP, BONK, WIF, PYTH, RAY**, or paste **any custom Solana mint**.
  - GlassJar executes a 2-step pipeline:
    1. **Step 1 (Solana)**: Swaps the chosen SPL token to bridged COOK on Solana via the live Jupiter v1 Swap Engine.
    2. **Step 2 (Cookie Chain)**: Dispatches the COOK across the Hyperlane Warp Route directly to the user's Cookie Chain address.
- **Destination Collateral Preflight**: Probes destination contract pool reserves before signing to ensure incoming funds will never be locked behind an undeliverable Hyperlane message.
- **Smart Gas Protection**: Automatically reserves a `0.008 SOL` buffer when bridging native SOL and warns if a wallet has insufficient fees to cover Solana gas.
- **Two-Phase Delivery Tracking**: Tracks the transfer from source confirmation through Hyperlane relayer delivery using the 32-byte message ID.

### 5. 🚀 MomoSwap Bonding Curve Launchpad (`/launch`)
- **Direct Launch Interface**: Launch new tokens on MomoSwap’s bonding curve (`momoswap.fun`) directly from GlassJar.
- **Immutable IPFS Metadata**: Mandatory logo upload pinned to IPFS, metadata configuration, and ticker verification.
- **Bundled Dev-Buys via ALT**: Atomic create + initial purchase bundled into a single versioned transaction using MomoSwap's published Address Lookup Table (`CawUNMrsk6KwjXZ8kNPQgC1obMD4QM5oqvo3rF2bErX6`).
- **Curve Trading & Claiming**: Buy and sell curve shares pre-graduation, track active positions, and claim SPL tokens once graduated.

### 6. 👤 Portfolio & Watchlist (`/profile`, `/watchlist`)
- **Live Balances**: View real-time balances for native COOK and all SPL tokens in your connected wallet.
- **Activity Feed**: Comprehensive on-chain history of all swaps, bridge transfers, and launches executed through the app.
- **Persistent Watchlists**: Sync favorite tokens across sessions via Supabase non-custodial user storage.

### 7. 🚰 Devnet Faucet (`/faucet`)
- Built-in COOK distribution interface for testing and onboarding new community members.

---

## 🌐 Chain & Contract Reference

| Parameter | Value | Details |
|---|---|---|
| **Network** | Cookie Chain Mainnet | Independent SVM Cluster |
| **HTTP RPC** | `https://rpc.cookiescan.io` | Cluster JSON-RPC |
| **WebSocket RPC** | `wss://wss.cookiescan.io` | Real-time subscription stream |
| **DAS API** | `https://api.cookiescan.io` | Digital Asset Standard API & token indexer |
| **Explorer** | `https://cookiescan.io` | Official block explorer |
| **Genesis Hash** | `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2` | Validated at app initialization |
| **Native Asset** | `COOK` | **9 Decimals** |
| **Solana Warp Mint** | `36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1` | Token-2022, **6 Decimals** |
| **Cookie Warp Program ID** | `Aa9wq46NB7qkg1amnBuMRsV1DunmkPHuoRLWZgWiBKdn` | Hyperlane Warp Route on Cookie Chain |
| **Solana Warp Program ID** | `B1C91jLcqXYYz57bBWR8dSEjBrJDhWSeNokZ5SDEopu3` | Hyperlane Warp Route on Solana |
| **MomoSwap ALT** | `CawUNMrsk6KwjXZ8kNPQgC1obMD4QM5oqvo3rF2bErX6` | Address Lookup Table for versioned launch txs |

---

## 🛠 Tech Stack

- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/) + [Turbopack](https://turbo.build/)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + Custom Squircle UI tokens
- **SVM SDKs**:
  - `@solana/web3.js`
  - `@solana/wallet-adapter-react` & `@solana/wallet-adapter-react-ui`
  - `@solana/spl-token` (Token-2022 & Standard SPL support)
- **Wallets Supported**:
  - [Nightly Wallet](https://nightly.app/) (Primary Cookie Chain & Solana multi-chain wallet)
  - [Phantom](https://phantom.app/)
  - [Solflare](https://solflare.com/)
- **Cross-Chain & Liquidity Engines**:
  - [Hyperlane](https://hyperlane.xyz/) (Warp Route Mailbox & Relayers)
  - [Jupiter v1 Swap API](https://jup.ag/) (Solana-side Zap routing)
  - Cookieswap BAMM / Raydium CLMM Fork
- **Database & Cache**: [Supabase](https://supabase.com/) (Non-custodial watchlists, user preferences, and transaction indexing)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 📂 Project Architecture

```
glassjar/
├── app/
│   ├── (dashboard)/
│   │   ├── page.tsx                    # Discover — token market directory & live terminal
│   │   ├── swap/page.tsx               # Cookieswap Swap Terminal
│   │   ├── bridge/page.tsx             # Hyperlane Warp Route & Zap Bridge Terminal
│   │   ├── launch/page.tsx             # MomoSwap Bonding Curve Launchpad
│   │   ├── token/[mint]/page.tsx       # Individual Token Analytics, Chart & Audit
│   │   ├── watchlist/page.tsx          # Saved Watchlist & PnL Deltas
│   │   ├── faucet/page.tsx             # COOK Distribution Faucet
│   │   └── profile/page.tsx            # Portfolio Balances & Activity History
│   ├── api/
│   │   ├── bridge/                     # Hyperlane build-tx, broadcast, reserves & delivery
│   │   ├── solana-swap/                # Jupiter quote & versioned swap builder
│   │   ├── solana-balance/             # Server-side Solana SPL & Token-2022 balance proxy
│   │   ├── swap/                       # Cookieswap quote & execution proxies
│   │   └── token-image/                # IPFS & Web3 image caching gateway
│   └── layout.tsx                      # Root layout, providers & navigation
├── components/
│   ├── bridge/                         # BridgeTerminal, SolanaTokenSelectModal
│   ├── swap/                           # SwapCard, TokenSelectModal, SlippageSettings
│   ├── launch/                         # LaunchForm, BondingCurveCard, MyLaunches
│   ├── portfolio/                      # TokenHoldingsTable, PortfolioSummary
│   ├── wallet/                         # WalletProvider, WalletModal, AddressBadge
│   └── ui/                             # TokenAvatar, Chart, Squircle Containers
├── lib/
│   ├── chain.ts                        # Connection setup, genesis hash check, RPC wrappers
│   ├── bridge.ts                       # Hyperlane Warp Route + Jupiter Zap Bridge client
│   ├── cookieswap.ts                   # Cookieswap quote & swap transaction builder
│   ├── momoswap.ts                     # MomoSwap launchpad position readers & deploy tx
│   ├── das.ts                          # Cookie DAS API client for metadata & price feeds
│   └── supabase.ts                     # Watchlist and preference persistence
├── public/                             # Logos, branding assets, icons
├── AGENTS.md                           # Developer & Agent instructions
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js `20.x` or later
- npm or pnpm
- A Solana / Cookie Chain compatible wallet (e.g. **Nightly Wallet**)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/thejustinson/glassjar.git
   cd glassjar
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env.local` and configure:
   ```bash
   cp .env.example .env.local
   ```
   *Values in `.env.example` contain production-ready public endpoints for Cookie Chain.*

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

---

## 🏆 Bounty Requirements Checklist

| Requirement | Implementation Status | Evidence / Location |
|---|:---:|---|
| **Nightly Wallet Support** | ✅ Complete | Verified in [`WalletProvider.tsx`](file:///c:/projects/glassjar/components/wallet/WalletProvider.tsx), supports both Cookie Chain & Solana. |
| **Truncated Address & Copy** | ✅ Complete | Address pill in header with `XXXX...XXXX` formatting and 1-click clipboard copy. |
| **Real Transaction Execution** | ✅ Complete | Direct signing of VersionedTransactions on Cookie Chain via Cookieswap & MomoSwap. |
| **Transaction Confirmation Handling** | ✅ Complete | Explicit state machine (`idle` $\to$ `preparing` $\to$ `signing` $\to$ `source_confirming` $\to$ `awaiting_delivery` $\to$ `delivered`). |
| **User-Facing Error Feedback** | ✅ Complete | Custom handling for signature rejection, slippage breach, gas shortage, and collateral errors. |
| **Portfolio & Activity View** | ✅ Complete | Live balance parsing and recent tx feed located at [`/profile`](file:///c:/projects/glassjar/app/(dashboard)/profile/page.tsx). |
| **Price Charts via DAS API** | ✅ Complete | Historical trade feeds and DAS analytics rendered on [`/token/[mint]`](file:///c:/projects/glassjar/app/(dashboard)/token/[mint]/page.tsx). |
| **Cookieswap Program Integration** | ✅ Complete | Verified swap quotes and on-chain swap dispatch in [`lib/cookieswap.ts`](file:///c:/projects/glassjar/lib/cookieswap.ts). |
| **MomoSwap Launchpad Integration** | ✅ Complete | Bonding curve deploy, buy, sell, and claim in [`lib/momoswap.ts`](file:///c:/projects/glassjar/lib/momoswap.ts). |
| **Cross-Chain Hyperlane Bridge** | ✅ Complete | 1:1 Warp Route bridge with live reserve checks in [`components/bridge/BridgeTerminal.tsx`](file:///c:/projects/glassjar/components/bridge/BridgeTerminal.tsx). |
| **Solana SPL Zap Bridge** | ✅ Complete | 2-step Jupiter $\to$ Hyperlane swap pipeline bridging any Solana token directly to Cookie Chain. |
| **Genesis Hash Assertion** | ✅ Complete | Verified boot-time check in [`lib/chain.ts`](file:///c:/projects/glassjar/lib/chain.ts) matching hash `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2`. |

---

## 🛡 Security & Design Principles

- **No Stored Private Keys**: All cryptographic signatures are produced exclusively inside the user's wallet extension via the `@solana/wallet-adapter` standard.
- **Simulation Before Signing**: Transactions are pre-simulated against the node before presenting a signature request to the user.
- **Fail-Safe Collateral Checks**: The Hyperlane bridge preflights destination collateral balances to protect users against pool lock-ups.
- **No Mock Fallbacks**: When an RPC or API is unreachable, GlassJar presents an explicit error banner rather than displaying misleading synthetic data.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

<div align="center">
Built with 🍯 for the <strong>Cookie Chain</strong> community.
</div>
