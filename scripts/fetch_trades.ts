import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Supabase URL present:', !!url, 'Key present:', !!key);
  if (!url || !key) return;

  const supabase = createClient(url, key);
  
  // Check engine_status
  const { data: status, error: statusErr } = await supabase
    .from('engine_status')
    .select('*');
  console.log('Engine Status:', status, statusErr);

  // Check total trades count
  const { count, error: countErr } = await supabase
    .from('futures_trades')
    .select('*', { count: 'exact', head: true });
  console.log('Total trades in table:', count, countErr);

  // Check recent trades
  const { data: trades, error: tradesErr } = await supabase
    .from('futures_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  console.log('Recent 50 trades count:', trades?.length, tradesErr);
  if (trades && trades.length > 0) {
    console.log('Sample trade:', JSON.stringify(trades[0], null, 2));
  }

  // Check market_signals
  const { count: sigCount } = await supabase
    .from('market_signals')
    .select('*', { count: 'exact', head: true });
  console.log('Total market signals:', sigCount);

  // Check virtual_wallet
  const { data: wallet } = await supabase
    .from('virtual_wallet')
    .select('*');
  console.log('Virtual wallet:', wallet);
}

main().catch(console.error);
