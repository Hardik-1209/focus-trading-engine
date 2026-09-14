import { fetchOpenFuturesTrades } from '../src/supabase-logger';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const trades = await fetchOpenFuturesTrades();
  console.log(`Found ${trades.length} open trade(s):`);
  for (const t of trades) {
    console.log(`[OPEN] ${t.symbol} ${t.position_side} Entry: ${t.entry_price} SL: ${t.stop_loss_price} TP: ${t.take_profit_price} opened: ${t.created_at}`);
  }
}
run();
