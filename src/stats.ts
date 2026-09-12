import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { fetchCurrentPrice } from './coin-selector';

async function runStats() {
  console.log('Fetching statistics from Supabase...');
  
  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: trades, error } = await supabase
    .from('futures_trades')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching trades:', error.message);
    process.exit(1);
  }
  
  if (!trades || trades.length === 0) {
    console.log('\nNo trades found in the database.');
    process.exit(0);
  }
  
  let totalTrades = trades.length;
  let openTrades = 0;
  let closedTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalRealizedPnl = 0;
  
  console.log('\n============================================================');
  console.log('                 📊 TRADING STATISTICS 📊                   ');
  console.log('============================================================\n');
  
  console.log('--- RECENT TRADES (Last 10) ---');
  
  // Need a for loop to await fetchCurrentPrice
  for (const t of trades.slice(0, 10)) {
    const entry = parseFloat(t.entry_price);
    const amount = parseFloat(t.amount);
    
    // TP/SL are calculated based on leveraged risk targets
    const tpMove = (0.08 / 5); // 1.6% move for 8% leveraged profit
    const slMove = (0.10 / 5); // 2.0% move for 10% leveraged loss
    
    let tpTarget = 0;
    let slTarget = 0;
    
    if (t.position_side === 'LONG') {
      tpTarget = entry * (1 + tpMove);
      slTarget = entry * (1 - slMove);
    } else {
      tpTarget = entry * (1 - tpMove);
      slTarget = entry * (1 + slMove);
    }

    const timeStr = new Date(t.created_at).toLocaleString();

    if (t.status === 'OPEN') {
      openTrades++;
      
      let currentPrice = 0;
      let pnl = 0;
      let pnlPct = 0;
      try {
        currentPrice = await fetchCurrentPrice(t.symbol);
        pnl = t.position_side === 'LONG' 
          ? (currentPrice - entry) * amount 
          : (entry - currentPrice) * amount;
        pnlPct = (pnl / (entry * amount)) * 100 * 5; // Leveraged %
      } catch (err) {
        console.warn(`(Could not fetch live price for ${t.symbol})`);
      }

      console.log(`[OPEN]   ${t.symbol} ${t.position_side} | Opened: ${timeStr}`);
      console.log(`         Entry: $${entry.toFixed(5)} | Size: ${amount.toFixed(2)}`);
      
      if (currentPrice > 0) {
        const pnlStr = pnl >= 0 ? `+\$${pnl.toFixed(4)}` : `-\$${Math.abs(pnl).toFixed(4)}`;
        const pctStr = pnlPct >= 0 ? `+${pnlPct.toFixed(2)}%` : `${pnlPct.toFixed(2)}%`;
        const color = pnl >= 0 ? '\x1b[32m' : '\x1b[31m';
        const reset = '\x1b[0m';
        
        console.log(`         Live:  $${currentPrice.toFixed(5)} | Unrealized PnL: ${color}${pnlStr} (${pctStr})${reset}`);
        
        // Calculate distance to targets
        const distTp = Math.abs((currentPrice - tpTarget) / currentPrice * 100).toFixed(2);
        const distSl = Math.abs((currentPrice - slTarget) / currentPrice * 100).toFixed(2);
        console.log(`         Target TP: $${tpTarget.toFixed(5)} (${distTp}% away) | Hard SL: $${slTarget.toFixed(5)} (${distSl}% away)`);
      } else {
        console.log(`         Target TP: $${tpTarget.toFixed(5)} (+8%) | Hard SL: $${slTarget.toFixed(5)} (-10%)`);
      }
    } else if (t.status === 'CLOSED') {
      closedTrades++;
      const pnl = parseFloat(t.realized_pnl || '0');
      totalRealizedPnl += pnl;
      if (pnl > 0) winningTrades++;
      else if (pnl < 0) losingTrades++;
      
      const pnlStr = pnl >= 0 ? `+$${pnl.toFixed(4)}` : `-$${Math.abs(pnl).toFixed(4)}`;
      console.log(`[CLOSED] ${t.symbol} ${t.position_side} | Opened: ${timeStr}`);
      console.log(`         Entry: $${entry.toFixed(5)} -> Exit: $${t.exit_price || 'N/A'} | PnL: ${pnlStr}`);
    } else {
      console.log(`[${t.status}] ${t.symbol} ${t.position_side} | Entry: $${entry.toFixed(5)}`);
    }
  }
  
  // Calculate remaining totals
  for (let i = 10; i < trades.length; i++) {
    const t = trades[i];
    if (t.status === 'OPEN') openTrades++;
    else if (t.status === 'CLOSED') {
      closedTrades++;
      const pnl = parseFloat(t.realized_pnl || '0');
      totalRealizedPnl += pnl;
      if (pnl > 0) winningTrades++;
      else if (pnl < 0) losingTrades++;
    }
  }
  
  const winRate = closedTrades > 0 ? ((winningTrades / closedTrades) * 100).toFixed(1) : '0.0';
  
  console.log('\n--- OVERALL SUMMARY ---');
  console.log(`Total Trades Taken : ${totalTrades}`);
  console.log(`Currently Open     : ${openTrades}`);
  console.log(`Completed Trades   : ${closedTrades}`);
  console.log(`Win/Loss Ratio     : ${winningTrades} W / ${losingTrades} L (${winRate}% Win Rate)`);
  
  const pnlColor = totalRealizedPnl >= 0 ? '\x1b[32m' : '\x1b[31m'; // green or red
  const resetColor = '\x1b[0m';
  console.log(`Total Realized PnL : ${pnlColor}$${totalRealizedPnl.toFixed(4)}${resetColor}`);
  
  try {
    const { fetchWalletBalance } = require('./supabase-logger');
    const balance = await fetchWalletBalance();
    console.log(`Current Wallet     : $${balance.toFixed(2)}`);
  } catch (err) {
    console.log(`Current Wallet     : (Could not fetch)`);
  }
  
  console.log('\n============================================================\n');
}

runStats().catch(console.error);
