import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
  const token = process.env.supabase_accesss_token;
  if (!token) throw new Error('Missing supabase_accesss_token');

  console.log('[Migration] Starting database upgrade via Supabase Management API...');

  const ddl = `
  -- 1. Upgrade futures_trades with advanced execution columns
  ALTER TABLE public.futures_trades
    ADD COLUMN IF NOT EXISTS tier integer DEFAULT 1,
    ADD COLUMN IF NOT EXISTS llm_source text DEFAULT 'groq',
    ADD COLUMN IF NOT EXISTS take_profit_price numeric,
    ADD COLUMN IF NOT EXISTS stop_loss_price numeric,
    ADD COLUMN IF NOT EXISTS trailing_stop_pct numeric,
    ADD COLUMN IF NOT EXISTS atr numeric,
    ADD COLUMN IF NOT EXISTS exit_reason text,
    ADD COLUMN IF NOT EXISTS fee numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS return_pct numeric DEFAULT 0;

  -- 2. Create market_signals table for deep audit & accuracy tracking
  CREATE TABLE IF NOT EXISTS public.market_signals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp timestamp with time zone DEFAULT now(),
    symbol text NOT NULL,
    action text NOT NULL,
    tier integer NOT NULL,
    approved boolean NOT NULL DEFAULT false,
    llm_source text,
    confidence numeric,
    indicators jsonb NOT NULL DEFAULT '{}'::jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT now()
  );

  -- 3. Create engine_status table for real-time state & telemetry
  CREATE TABLE IF NOT EXISTS public.engine_status (
    id text PRIMARY KEY DEFAULT 'primary',
    last_heartbeat timestamp with time zone DEFAULT now(),
    is_running boolean DEFAULT true,
    focused_symbol text,
    watch_started_at timestamp with time zone,
    cycle_count integer DEFAULT 0,
    active_trades_count integer DEFAULT 0,
    win_rate numeric DEFAULT 0,
    total_pnl numeric DEFAULT 0,
    active_groq_key_index integer DEFAULT 0,
    mode text DEFAULT 'DRY_RUN',
    updated_at timestamp with time zone DEFAULT now()
  );

  -- Upsert initial engine status record
  INSERT INTO public.engine_status (id, is_running, mode)
  VALUES ('primary', true, 'DRY_RUN')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Create performance indexes for real-time dashboard subscriptions
  CREATE INDEX IF NOT EXISTS idx_futures_trades_status ON public.futures_trades(status);
  CREATE INDEX IF NOT EXISTS idx_futures_trades_created_at ON public.futures_trades(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_system_health_ts ON public.system_health_events(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_system_health_component ON public.system_health_events(component);
  CREATE INDEX IF NOT EXISTS idx_market_signals_ts ON public.market_signals(timestamp DESC);
  `;

  const res = await fetch('https://api.supabase.com/v1/projects/hnruqahncdniwyirgorh/database/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: ddl })
  });

  const data = await res.json();
  if (res.ok) {
    console.log('✅ [Migration] Database schema upgraded successfully!');
  } else {
    console.error('❌ [Migration] Failed:', data);
  }
}

runMigration().catch(console.error);
