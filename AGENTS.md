# AGENTS.md — GlassJar

This file tells coding agents (Claude Code, Cursor, etc.) how to work in this repo. Read this before making changes. If something here conflicts with what you observe in the code, the code wins — update this file to match.

---

## 1. What this project is

**GlassJar** is a trading dashboard / swap terminal for **Cookie Chain**, an independent SVM-compatible Layer 1 (NOT Solana mainnet — same VM, different validator set, different genesis, different native asset). Domain: `glassjar.fun` (naming convention matches the ecosystem — Cookieswap, MomoSwap, and most Cookie Chain-adjacent projects also use `.fun`). Previously referred to in planning as "Cookie Desk" — that name is retired, don't reintroduce it in code, copy, or file names.

Built for the Superteam Earn bounty **"Create an App on Cookie Chain."**

Core promise to the user: connect a wallet, see real balances, execute a real swap on Cookie Chain, watch a real transaction confirm, track a watchlist with lightweight PnL. Nothing here is a mock or a simulated transaction — every "execute" button submits a real signed transaction to Cookie Chain and every status shown reflects real RPC/WebSocket state.

### Required features (bounty checklist — do not regress these)
- Wallet connection, with **Nightly** support required (primary wallet)
- Display connected wallet address (truncated, with copy-to-clipboard)
- Real transaction execution against Cookie Chain
- Transaction confirmation handling (pending → confirmed/failed, not just "submitted")
- Explicit error handling and user-facing feedback for every failure mode (rejected signature, insufficient balance, RPC timeout, slippage exceeded, swap route unavailable)
- Application-specific data/activity view (recent txs, portfolio)
- Analytics/chart surface (price charts via DAS API)
- Use of an existing Cookie Chain program for swaps (Cookieswap) — not a custom token you mint yourself

---

## 2. Non-negotiables (read this twice)

1. **Cookie Chain is not Solana mainnet.** Every RPC call, explorer link, and genesis check must point at Cookie Chain endpoints below. If you ever see a hardcoded Solana mainnet-beta endpoint, that's a bug — remove it.
2. **Never fabricate transaction state.** No "optimistic success" toasts before the RPC actually confirms. If we don't know the state, show "pending" or "unknown," never a false "success."
3. **Never store or transmit a private key or seed phrase.** All signing happens in the user's wallet extension via the wallet-adapter standard. If you write code that asks a user to paste a private key, stop and flag it — that's out of scope for this app entirely.
4. **No mock/demo data in production paths.** Loading skeletons are fine. Silently falling back to hardcoded fake prices or fake balances is not — surface an error state instead.
5. **Don't invent Cookie Chain program addresses, token mints, or API response shapes.** If you need a program ID, pool address, or endpoint you don't already have documented in this file or in `/docs`, stop and ask, or fetch it from the live docs (`docs.cookiechain.wtf`) — do not guess a plausible-looking address.
6. Slippage, fees, and any on-chain amount shown to the user must be computed from real quote data, not estimated client-side without a quote.

---

## 3. Chain reference

| Item | Value |
|---|---|
| Network | Cookie Chain mainnet (independent SVM cluster) |
| HTTP RPC | `https://rpc.cookiescan.io` |
| WebSocket | `wss://wss.cookiescan.io` |
| DAS API (token metadata, pricing, analytics) | `https://api.cookiescan.io` |
| Explorer | `https://cookiescan.io` |
| Docs | `https://docs.cookiechain.wtf` |
| Bridge (Solana → Cookie Chain) | `https://bridge.cookiechain.wtf` / Hyperlane warp route at `hyperlane.cookiescan.io` |
| Native asset | `COOK`, 9 decimals |
| Genesis hash | `9wDaBRDgArEUpvhHxGguNkwozsZh4UpGZB9o2EoEcBB2` |
| SPL Memo program | `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr` (same as Solana — SPL programs are compatible) |
| VM | SVM (Solana-core compatible; Solana `@solana/web3.js` and wallet-adapter libraries work unmodified when pointed at the Cookie RPC) |

**Sanity check pattern:** on app boot (or in a debug panel), call `getGenesisHash` against the configured RPC and assert it matches the value above. If it doesn't match, the app is misconfigured and should show a hard error, not proceed — this is the cheapest possible guard against accidentally pointing at Solana mainnet or a stale endpoint.

Cookieswap and the Cookie DAS API are third-party/ecosystem services layered on top of the chain — verify their current SDK/REST shape against their own docs before wiring in guessed request/response types (`https://cookieswap.fun/`, `https://api.cookiescan.io/`). Do not assume their API surface mirrors Jupiter's or Raydium's just because the ecosystem is Solana-flavored.

---

## 3a. Bridge (Solana ↔ Cookie Chain)

Verified against the official `cookiechain/cookie-mcp` repo (MIT licensed) — treat this as source-of-truth over any community-hackathon README, and re-verify against that repo if it has moved on since this was written.

- **Route:** a Hyperlane warp route moves COOK 1:1 between Cookie Chain and Solana mainnet. Direction is one of two literal values: `cookie-to-solana` or `solana-to-cookie`.
- **Decimals differ by side, this is not a bug to "fix":** Cookie Chain native COOK is **9 decimals**. The bridged representation on Solana is a **Token-2022 mint, 6 decimals**, address `36ZrtQoab5MhhySaP1YSTwUahSk6GRVUTtZ6cuVfm9e1`. Always display/format using the decimals of the side you're rendering — never assume both sides share one decimal count.
- **Two-phase settlement, not one confirmation:** one signature on the source chain dispatches the transfer; a relayer delivers on the destination chain separately, typically within a few minutes. Track status via the Hyperlane **message id**, not by polling the destination chain's balance and hoping. Our tx-status component needs a distinct "sent — awaiting delivery" state between "confirmed on source" and "complete," per the non-negotiables in §2.
- **Destination collateral risk:** the route releases funds from a fixed collateral account on the destination side. A transfer larger than that collateral cannot be caught by simulating on the source chain — it silently locks the user's funds behind an undeliverable message. Preflight the destination collateral balance before letting a user submit a transfer that would exceed it (this is exactly what `cookie-mcp`'s `bridge` tool does before signing).
- **`cookie-to-solana` needs a destination token account:** delivery credits an SPL associated token account for the recipient; if none exists, it must be created first (one extra Solana-side tx, ~0.0021 SOL rent, reclaimable by the recipient later). There's a documented real failure mode (occurred 2026-08-26) where an auto-create funding mechanism ran dry and a transfer hung with **no error surfaced anywhere**. Design for this explicitly — don't let "no error yet" read as "still pending" indefinitely; set a timeout and tell the user to check manually past it.
- **Program IDs are not publicly documented.** `cookie-mcp` ships default mainnet warp-route program IDs hardcoded in its source rather than in its README or `.env.example`. If we integrate at the SDK/program level directly (rather than depending on `cookie-mcp` itself), we need to either pull the exact IDs from `cookie-mcp`'s source (MIT license permits this) or resolve them live from Hyperlane's own registry/API — do not guess or reuse an ID copied from an unrelated warp route.

---

## 3b. Launchpad (MomoSwap integration) — priority feature

Cookie Chain already has a dedicated launchpad, **MomoSwap** (`momoswap.fun`). GlassJar is not building its own bonding-curve program — it's building a launch UI against MomoSwap's existing one, the same way `cookiechain/cookie-mcp`'s `deploy_token` / `launchpad_buy` / `launchpad_sell` / `claim_launchpad` tools do. Treat that repo as the reference implementation for this integration, same as it is for the bridge.

- **Flow:** create a token on a COOK bonding curve (name, ticker, logo required — or explicit opt-out — plus optional dev-buy amount bundled into the same transaction), let people buy/sell the curve pre-graduation, and let the creator claim the real SPL token (or a Fair-mode refund / Jackpot-Survivor payout) once it graduates, plus sweep creator fees.
- **Logo requirement is a hard constraint, not a nice-to-have:** a logo is required to launch (`imageBase64`, pinned to IPFS) unless the creator explicitly opts out (`noLogo: true`). Metadata is immutable once set — there is no "add a logo later." The launch form must make this a real decision point, not an afterthought field.
- **Pre-graduation holdings are not SPL tokens.** They're program-tracked curve shares — they will not show up in a normal `getBalance`/token-account read, and the swap terminal cannot route them (no DEX pool exists yet). This means the "my launches" view cannot reuse the portfolio balance list as-is; it needs its own read against the program's position accounts, the way `cookie-mcp`'s `get_launchpad_positions` does.
- **After graduation, it's a normal SPL token** — from that point it trades through the existing Cookieswap swap terminal like anything else. This is a real, current API/tool distinction (not just "check price is null") — `get_token_info`-equivalent reads should surface a `launchpad` field/state when a mint has no price or liquidity because it's still on a curve, so the UI knows to route to the launch/curve view instead of the swap terminal for that token.
- **Real cost, must be shown before commit:** launching costs a creation fee read live from the launchpad's config at call time, plus whatever COOK the optional dev-buy spends. Never hardcode this fee — fetch it and show it in the confirm step, same principle as §2's "no fabricated amounts."
- **A dev-buy bundled into the launch transaction has a real technical dependency:** per `cookie-mcp`, bundling create+buy into one transaction only works as a versioned transaction built over MomoSwap's launchpad Address Lookup Table (a frozen, published ALT — `cookie-mcp` defaults to `CawUNMrsk6KwjXZ8kNPQgC1obMD4QM5oqvo3rF2bErX6`, pinned rather than read from an API response, since the party building the transaction shouldn't be the one asserting what its own lookup indices mean). Without a correct ALT reference, a launch-with-dev-buy either fails or must be split into two steps (launch, then a separate `launchpad_buy`-equivalent) — don't guess at this ALT address without re-confirming it against `cookie-mcp`'s current source, since it's described there as override-only for non-production deployments.
- **Trade this against the swap-execution pattern in §7** — same simulate → sign → confirm → error-handle shape applies to every launchpad action (create, buy, sell, claim).

---

## 4. Tech stack

- **Next.js (App Router) + TypeScript**
- **`@solana/web3.js`** + **`@solana/wallet-adapter-react`**, `wallet-adapter-react-ui`, `wallet-adapter-wallets` — Nightly first, Phantom/Solflare as fallback. Point the `Connection` and `WalletAdapterNetwork`-style config at the Cookie RPC/WS endpoints above, not a Solana cluster constant.
- **Supabase** — off-chain state only: per-wallet watchlists, cached price history for chart rendering, user preferences. Never store balances or tx signatures as source of truth here — always re-derive from chain/DAS API; Supabase is a cache/convenience layer, not the ledger.
- **Cookieswap** integration for swap quotes + execution (SDK if one exists, otherwise direct program interaction per their docs)
- **MomoSwap** launchpad integration for the token-launch flow (§3b) — build the bonding-curve creation tx the same way `cookie-mcp`'s `deploy_token` does; treat this as a peer of the Cookieswap integration in priority, not an afterthought
- **Cookie DAS API** for token metadata, pricing, and historical data for charts
- Charting: any lightweight React chart lib (e.g. `recharts` or `lightweight-charts`) — pick one and be consistent, don't mix
- Deploy target: Vercel

---

## 4a. UI feel

Reference point: Birdeye, in the sense of dense, information-forward trading-terminal UI — but GlassJar is a single-chain, wallet-first execution app, not a multi-chain market-discovery homepage. Borrow the visual language, not the structure.

**Borrow from that reference:**
- Dark-capable, high information density, tabular numeric layout — this is a tool for people actively trading, not a marketing page
- Token row pattern: icon, symbol, price, 24h change — used consistently across the watchlist, the discover/markets list, and any token picker in the swap flow
- Flat top-level nav (Discover / Swap / Bridge / Launch / Watchlist) as a row of tabs, plus a profile/account button (portfolio, activity) off to the side rather than in the main nav row — fine at this screen count, revisit if it grows

**Explicitly do not borrow:**
- No multi-chain switcher — GlassJar is Cookie Chain only, that whole affordance doesn't exist here
- No smart-money/profitable-traders leaderboard — needs wallet-behavior indexing infrastructure out of scope for this build
- No bubble map — nice stretch goal, not a v1 surface
- No ad/promo banners, obviously

**Layout principle:** the landing screen is **Discover** — the market/token list, browsable with no wallet connected — not the portfolio. Portfolio (balances, USD value, 24h change) lives behind a profile/account button, not on the homepage. This is the core thing that keeps GlassJar feeling like a market terminal instead of "just a wallet with extra steps": there's always market content to land on, wallet-specific data is one click away once connected, and an unconnected visitor sees a working product immediately instead of an empty balances screen.

**Visual tokens:**
- Green/red for price deltas and confirmed/failed tx states — standard, don't invent a different scheme
- A third, distinct color (amber/warning, not red) for in-progress/pending states — this matters especially for the bridge's "awaiting delivery" phase (§3a), which is neither success nor failure
- Card-based sections (portfolio metrics, watchlist, swap panel, activity feed) on a flat surface — no gradients, no heavy shadows, keep it calm and legible over dense
- Support both light and dark mode via theme tokens/CSS variables rather than hardcoding a dark palette — don't hardcode dark-only colors, since the whole point of the "trading terminal" feel is density and clarity, not literally forcing dark mode on every user

---

## 5. Project structure

```
/app
  /(dashboard)
    /page.tsx                 → Discover — the landing screen, market/token list, browsable with no wallet connected
    /swap/page.tsx             → swap terminal
    /bridge/page.tsx           → bridge flow
    /launch/page.tsx           → MomoSwap launch form + browse active launches
    /launch/[mint]/page.tsx    → single launch/curve view (buy/sell curve, claim after graduation)
    /watchlist/page.tsx        → watchlist + PnL
  /profile/page.tsx            → portfolio balances, activity feed, "my launches" — everything wallet-specific lives here, off the main nav
  /api                         → server routes (if any server-side proxying of DAS/Cookieswap/MomoSwap is needed to hide rate limits or aggregate calls)
/components
  /wallet                      → connect button, address display, wallet modal
  /swap                        → pair selector, quote panel, slippage control, confirm/execute flow
  /bridge                      → direction picker, collateral preflight warning, two-phase status tracker
  /launch                      → launch form, logo upload, dev-buy toggle, curve buy/sell, my-launches list
  /charts                      → price chart components
  /portfolio                   → balance list, PnL cards
  /tx                          → transaction status toast/banner, confirmation tracker
/lib
  /chain.ts                    → Connection setup, genesis-hash sanity check, RPC helpers
  /cookieswap.ts                → quote + swap execution wrapper
  /momoswap.ts                   → launchpad reads (pools, positions) + writes (deploy, buy, sell, claim)
  /bridge.ts                     → Hyperlane warp-route transfer + message-status wrapper
  /das.ts                       → DAS API client (metadata, pricing, history)
  /supabase.ts                  → Supabase client + watchlist/preferences queries
  /format.ts                    → address truncation, amount formatting, decimals handling
/docs
  → paste-in copies or links to the exact Cookieswap/DAS API/MomoSwap docs you integrated against, with the date you checked them
.env.local.example
AGENTS.md
README.md
```

Adjust as the app grows, but keep the principle: **chain/quote/API logic lives in `/lib`, is unit-testable and framework-agnostic; components stay thin and call into `/lib`.**

---

## 6. Environment variables

```
NEXT_PUBLIC_COOKIE_RPC=https://rpc.cookiescan.io
NEXT_PUBLIC_COOKIE_WSS=wss://wss.cookiescan.io
NEXT_PUBLIC_COOKIE_DAS_API=https://api.cookiescan.io
NEXT_PUBLIC_COOKIE_EXPLORER=https://cookiescan.io
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# Cookieswap-specific vars go here once confirmed from their docs — do not guess key names
```

Read these from `process.env`, never hardcode endpoints inline in components — route everything through `/lib/chain.ts` and `/lib/das.ts` so a single env change repoints the whole app.

---

## 7. Transaction execution pattern (apply everywhere a tx is sent)

1. Build the transaction (swap instruction from Cookieswap, or system transfer, etc.)
2. Simulate first if the RPC supports `simulateTransaction` — surface simulation errors before asking the user to sign
3. Request signature via the connected wallet adapter — handle **user rejection** as a distinct, non-scary error state ("Signature cancelled," not "Transaction failed")
4. Submit, then poll or subscribe (via WS) for confirmation — show a pending state with the tx signature linked to the explorer immediately
5. On confirmation: show success with final amounts/fees actually paid (read from the confirmed tx, not the pre-submission estimate)
6. On failure: show the actual on-chain error reason if available, not just "transaction failed"
7. Every terminal state (success, failure, rejected, timeout) must be reachable from the UI — no infinite spinners. Set a reasonable timeout (e.g. 60s) after which the UI tells the user to check the explorer manually rather than spinning forever.

---

## 8. Coding conventions

- TypeScript strict mode on. No `any` in `/lib` — chain and API responses get real types.
- Amounts: always work in base units (lamports-equivalent, respecting each token's decimals) internally; convert to display units only at the render layer. Off-by-decimal bugs are the easiest way to show a wrong balance or swap amount — be paranoid here.
- Wallet address display: truncate as `XXXX…XXXX` (first 4 / last 4), always provide the full address on hover/copy.
- Every async chain/API call needs an explicit loading, error, and empty state in the UI — no bare `try/catch` that silently swallows and leaves a blank screen.
- Keep Cookieswap and DAS API client code isolated in `/lib` so that if either service changes its API shape, the blast radius is one file, not scattered `fetch` calls across components.

---

## 9. What "done" looks like for the bounty submission

- [ ] Nightly wallet connects and address displays correctly
- [ ] Real COOK + SPL token balances shown, pulled live from RPC/DAS
- [ ] Swap terminal executes a real Cookieswap swap end-to-end with correct confirmation + error handling
- [ ] Price chart renders from real DAS API data for at least the swapped pair
- [ ] Watchlist persists per-wallet (Supabase) and shows since-watched delta
- [ ] Recent activity feed shows real txs for the connected wallet with explorer links
- [ ] Deployed publicly (Vercel), repo public with a full README (setup, env vars, architecture, what's implemented vs. stretch)
- [ ] Genesis-hash sanity check in place so the app cannot silently point at the wrong cluster
- [ ] MomoSwap launch flow works end-to-end: create a token on a bonding curve, buy/sell the curve, claim after graduation — real transactions, real confirmation/error handling, matching §7's pattern
- [ ] Discover screen (landing) works without a connected wallet; portfolio/activity live behind the profile button and require a connection

---

## 10. Open questions to resolve before/while building (do not guess these — verify against live docs)

Q: Exact Cookieswap integration surface: SDK package name, or raw program interaction? Quote endpoint shape?
A: The verified Cookie Chain reference implementation does not rely on a single "Cookieswap SDK" wrapper. The codebase uses the Cookie Chain DEX ecosystem through public swap endpoints and program-level liquidity logic: Cookiebox aggregate/quote APIs and Candy Shop / Cookiescan swap APIs for quotes and execution, while CookieSwap BAMM is implemented via the Raydium-CLMM fork program and direct pool operations. The dependable integration pattern is quote → build transaction → simulate → sign → send → confirm, not a guessed SDK-only path.

Q: Does the DAS API expose historical OHLC data for charts, or only current price/metadata? If not, may need to build a lightweight price-history cache in Supabase by polling.
A: The public Cookiescan docs show token metadata, price endpoints, market data, and a websocket tick stream, but no verified historical OHLC endpoint in the documented API surface. The safe design is to treat OHLC as absent unless specifically confirmed by the service, and use a polling / cache layer in Supabase if chart history is needed.

Q: Cookieswap fee structure and slippage model — needed to build an accurate quote panel.
A: Confirmed in the reference source: default slippage is 500 bps (5%), and Candy Shop / Cookiescan routing includes a roughly 20 bps protocol fee. CookieSwap BAMM pool config also uses a 1% trade fee in the default pool setup. Those values are source-of-truth numbers, not assumptions.

Q: Rate limits on `api.cookiescan.io` — determines whether calls should be proxied through a Next.js API route to add caching/backoff, vs. called directly client-side.
A: The public docs excerpt does not provide a published rate-limit contract for `api.cookiescan.io`. The verified source guidance is to treat rate limits as operationally real but unconfirmed, and to add a server-side proxy/cache layer only when the app demonstrates real rate or reliability pressure.

Q: Bridge (see §3a for what's already confirmed): the literal Hyperlane warp-route program IDs still need to be sourced from `cookie-mcp`'s code or Hyperlane's registry before writing any direct SDK integration — do not proceed to that step with a guessed ID.
A: Confirmed from the verified source: `COOKIE_WARP_PROGRAM_ID` is `Aa9wq46NB7qkg1amnBuMRsV1DunmkPHuoRLWZgWiBKdn` and `SOLANA_WARP_PROGRAM_ID` is `B1C91jLcqXYYz57bBWR8dSEjBrJDhWSeNokZ5SDEopu3`. The repo also tests these against known collateral accounts and treats them as real runtime defaults, not guessed values.

Q: Bridge: confirm whether Hyperlane exposes a public message-status endpoint/SDK call we can poll client-side for the "awaiting delivery" state, or whether that requires going through `cookiescan.io`/`hyperlane.cookiescan.io`'s own status surface instead.
A: Yes — the verified source implements `bridge_status` by Hyperlane message id and explicitly polls the destination mailbox for delivery. The correct pattern is to track the `messageId` and poll the destination mailbox/status surface, not to infer delivery from a destination balance alone.

Q: Discover/markets screen: at least one other community project referenced `GET https://api.cookiescan.io/api/markets` (top tokens by liquidity) as a working endpoint — unverified against official docs, treat as a lead to check, not a confirmed contract, before building the Discover tab against it.
A: Confirmed. `GET /api/markets` is part of the public Cookiescan REST API docs and is the relevant market feed for top-liquidity discovery. It is not an unverified guess.

Q: Launchpad (see §3b for what's already confirmed): exact MomoSwap program ID(s) and instruction/account layout for `deploy_token`/buy/sell/claim need to be sourced from `cookie-mcp`'s source or MomoSwap's own docs — same "don't guess an address" rule as the bridge.
A: The verified source does not hardcode the launchpad contract as permanent truth. It resolves launchpad ownership from the pool account and only falls back to `momoL7wu4TrXjnXMLCLzGsbx8Pm7XGgoYo7FVqDoqcw` when on-chain data is unavailable. The correct pattern is runtime resolution by pool owner / on-chain proof, not guessed IDs.

Q: Launchpad: re-confirm the launchpad ALT address (`CawUNMrsk6KwjXZ8kNPQgC1obMD4QM5oqvo3rF2bErX6` per `cookie-mcp`'s default) against current `cookie-mcp` source before relying on it for dev-buy-bundled launches — it's explicitly override-only for non-production deployments, so treat the literal value as a starting point to verify, not a settled fact.
A: Confirmed by the reference code: the launchpad ALT is treated as an on-chain verification concern and a pinned/frozen table is required for dev-buy-bundled launches. The source explicitly rejects a dev-buy if the ALT is not pinned/verified. Therefore, the correct rule is: verify the live ALT account on chain; do not trust an older literal as a permanent truth.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
