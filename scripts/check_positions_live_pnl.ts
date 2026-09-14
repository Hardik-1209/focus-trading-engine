import { fetchOpenFuturesTrades } from '../src/supabase-logger';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const trades = await fetchOpenFuturesTrades();
  console.log(`Checking ${trades.length} open position(s):`);

  for (const t of trades) {
    try {
      const res = await fetch(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${t.symbol}&productType=USDT-FUTURES`);
      const json = await res.json() as any;
      const lastPr = parseFloat(json?.data?.[0]?.lastPr || '0');
      const entry = parseFloat(t.entry_price);
      let pnlPct = 0;
      if (t.position_side === 'LONG') {
        pnlPct = ((lastPr - entry) / entry) * 100;
      } else {
        pnlPct = ((entry - lastPr) / entry) * 100;
      }
      console.log(`- ${t.symbol} [${t.position_side}]: Entry $${entry} | Current $${lastPr} | PnL: ${pnlPct.toFixed(2)}% | SL: $${t.stop_loss_price} | TP: $${t.take_profit_price}`);
    } catch (e: any) {
      console.error(`Failed ${t.symbol}: ${e.message}`);
    }
  }
}
run();
