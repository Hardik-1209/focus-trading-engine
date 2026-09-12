import dotenv from 'dotenv';
dotenv.config();

async function fixRLS() {
  const token = process.env.supabase_accesss_token;
  if (!token) throw new Error('Missing supabase_accesss_token');

  console.log('[RLS Fix] Applying public policies & enabling realtime...');

  const ddl = `
  -- Allow public read/write access to engine_status
  ALTER TABLE public.engine_status ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on engine_status" ON public.engine_status;
  CREATE POLICY "Allow public read on engine_status" ON public.engine_status FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow public write on engine_status" ON public.engine_status;
  CREATE POLICY "Allow public write on engine_status" ON public.engine_status FOR ALL USING (true);

  -- Allow public read/write access to trading_sessions
  ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on trading_sessions" ON public.trading_sessions;
  CREATE POLICY "Allow public read on trading_sessions" ON public.trading_sessions FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow public write on trading_sessions" ON public.trading_sessions;
  CREATE POLICY "Allow public write on trading_sessions" ON public.trading_sessions FOR ALL USING (true);

  -- Allow public read on market_signals
  ALTER TABLE public.market_signals ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on market_signals" ON public.market_signals;
  CREATE POLICY "Allow public read on market_signals" ON public.market_signals FOR SELECT USING (true);

  -- Allow public read/write on futures_trades
  ALTER TABLE public.futures_trades ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on futures_trades" ON public.futures_trades;
  CREATE POLICY "Allow public read on futures_trades" ON public.futures_trades FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow public write on futures_trades" ON public.futures_trades;
  CREATE POLICY "Allow public write on futures_trades" ON public.futures_trades FOR ALL USING (true);

  -- Allow public read/write on virtual_wallet
  ALTER TABLE public.virtual_wallet ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow public read on virtual_wallet" ON public.virtual_wallet;
  CREATE POLICY "Allow public read on virtual_wallet" ON public.virtual_wallet FOR SELECT USING (true);
  DROP POLICY IF EXISTS "Allow public write on virtual_wallet" ON public.virtual_wallet;
  CREATE POLICY "Allow public write on virtual_wallet" ON public.virtual_wallet FOR ALL USING (true);
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
  console.log('[RLS Fix] Response:', data);
}

fixRLS().catch(console.error);
