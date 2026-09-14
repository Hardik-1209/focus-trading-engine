import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await s.from('futures_trades').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log('Total trades found:', data.length);
  for (const t of data) {
    console.log(`[${t.status}] ${t.symbol} ${t.position_side} Entry: ${t.entry_price} PnL: ${t.realized_pnl} Reason: ${t.exit_reason || t.ai_reasoning?.slice(0, 100)} at ${t.created_at}`);
  }
}
run();
