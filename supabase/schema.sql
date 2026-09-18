-- ==============================================================================
-- GLASSJAR — SUPABASE DATABASE SCHEMA
-- Cookie Chain Trading Terminal Off-Chain Data & Analytics Layer
-- ==============================================================================

-- 1. WALLETS (Tracks connected wallets, engagement, preferences)
CREATE TABLE IF NOT EXISTS public.wallets (
  address TEXT PRIMARY KEY,
  first_connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connection_count INTEGER NOT NULL DEFAULT 1,
  wallet_name TEXT,
  preferences JSONB DEFAULT '{}'::jsonb
);

-- 2. WATCHLISTS (Per-wallet saved token watchlists with entry price & notes)
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES public.wallets(address) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  decimals INTEGER DEFAULT 9,
  logo_uri TEXT,
  added_price NUMERIC NOT NULL DEFAULT 0,
  target_price NUMERIC,
  notes TEXT,
  tracked_amount NUMERIC,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, mint)
);

-- 3. ANALYTICS_EVENTS (Telemetry for swaps, bridges, connects, feature usage)
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'wallet_connect', 'swap_executed', 'bridge_initiated', 'bridge_delivered', 'watchlist_add'
  wallet_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TRANSACTIONS (Cached swap and bridge activity for instant portfolio feeds)
CREATE TABLE IF NOT EXISTS public.transactions (
  signature TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  tx_type TEXT NOT NULL, -- 'swap' | 'bridge'
  source_chain TEXT NOT NULL, -- 'cookie' | 'solana'
  dest_chain TEXT,
  input_mint TEXT,
  input_symbol TEXT,
  input_amount NUMERIC,
  output_mint TEXT,
  output_symbol TEXT,
  output_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'confirmed', -- 'confirmed' | 'delivered' | 'failed'
  message_id TEXT, -- Hyperlane bridge message account / ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TOKEN_PRICE_CACHE (Optional fast-loading cache for token metrics)
CREATE TABLE IF NOT EXISTS public.price_cache (
  mint TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT,
  price_usd NUMERIC,
  price_change_24h NUMERIC,
  market_cap NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INDEXES FOR PERFORMANCE ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_watchlists_wallet ON public.watchlists(wallet_address);
CREATE INDEX IF NOT EXISTS idx_watchlists_mint ON public.watchlists(mint);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_wallet ON public.analytics_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- ─── ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────────
-- Since users authenticate with Web3 wallets rather than Supabase Email/Password,
-- anonymous clients (using anon key) need access to read and write records.

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

-- Wallets policies: anyone can read and upsert their wallet connection
DROP POLICY IF EXISTS "Allow anon select wallets" ON public.wallets;
CREATE POLICY "Allow anon select wallets" ON public.wallets FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert wallets" ON public.wallets;
CREATE POLICY "Allow anon insert wallets" ON public.wallets FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update wallets" ON public.wallets;
CREATE POLICY "Allow anon update wallets" ON public.wallets FOR UPDATE USING (true);

-- Watchlists policies: anyone can read, insert, update, delete watchlist items
DROP POLICY IF EXISTS "Allow anon select watchlists" ON public.watchlists;
CREATE POLICY "Allow anon select watchlists" ON public.watchlists FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert watchlists" ON public.watchlists;
CREATE POLICY "Allow anon insert watchlists" ON public.watchlists FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update watchlists" ON public.watchlists;
CREATE POLICY "Allow anon update watchlists" ON public.watchlists FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow anon delete watchlists" ON public.watchlists;
CREATE POLICY "Allow anon delete watchlists" ON public.watchlists FOR DELETE USING (true);

-- Analytics policies: anyone can insert events, read is public
DROP POLICY IF EXISTS "Allow anon insert analytics" ON public.analytics_events;
CREATE POLICY "Allow anon insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon select analytics" ON public.analytics_events;
CREATE POLICY "Allow anon select analytics" ON public.analytics_events FOR SELECT USING (true);

-- Transactions policies: anyone can insert and read transactions
DROP POLICY IF EXISTS "Allow anon select transactions" ON public.transactions;
CREATE POLICY "Allow anon select transactions" ON public.transactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert transactions" ON public.transactions;
CREATE POLICY "Allow anon insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update transactions" ON public.transactions;
CREATE POLICY "Allow anon update transactions" ON public.transactions FOR UPDATE USING (true);

-- Price cache policies: public read and upsert
DROP POLICY IF EXISTS "Allow anon select price_cache" ON public.price_cache;
CREATE POLICY "Allow anon select price_cache" ON public.price_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon upsert price_cache" ON public.price_cache;
CREATE POLICY "Allow anon upsert price_cache" ON public.price_cache FOR ALL USING (true);

-- ─── HELPER VIEWS FOR DASHBOARD & METRICS ────────────────────────────────────
CREATE OR REPLACE VIEW public.v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM public.wallets) AS total_connected_wallets,
  (SELECT COUNT(*) FROM public.transactions WHERE tx_type = 'swap') AS total_swaps_completed,
  (SELECT COUNT(*) FROM public.transactions WHERE tx_type = 'bridge') AS total_bridges_completed,
  (SELECT COUNT(*) FROM public.analytics_events) AS total_events_logged;
