import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

async function analyze() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Fetch all trades
  const { data: trades, error } = await supabase
    .from('futures_trades')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !trades) {
    console.error(error);
    return;
  }

  const { data: signals } = await supabase
    .from('market_signals')
    .select('*')
    .order('created_at', { ascending: true });

  const { data: status } = await supabase
    .from('engine_status')
    .select('*')
    .eq('id', 'primary')
    .single();

  const totalTrades = trades.length;
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const openTrades = trades.filter(t => t.status === 'OPEN');
  
  const winningTrades = closedTrades.filter(t => (t.realized_pnl || 0) > 0);
  const losingTrades = closedTrades.filter(t => (t.realized_pnl || 0) <= 0);

  const totalPnL = closedTrades.reduce((acc, t) => acc + (parseFloat(t.realized_pnl) || 0), 0);
  const totalFees = closedTrades.reduce((acc, t) => acc + (parseFloat(t.fee) || 0), 0);
  const grossPnL = totalPnL + totalFees;

  const winPnL = winningTrades.reduce((acc, t) => acc + (parseFloat(t.realized_pnl) || 0), 0);
  const lossPnL = losingTrades.reduce((acc, t) => acc + (parseFloat(t.realized_pnl) || 0), 0);

  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const profitFactor = Math.abs(lossPnL) > 0 ? (winPnL / Math.abs(lossPnL)) : 0;
  const avgWin = winningTrades.length > 0 ? winPnL / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? lossPnL / losingTrades.length : 0;
  const expectancy = (winRate / 100 * avgWin) + ((100 - winRate) / 100 * avgLoss);

  // Group by exit reason
  const exitReasons: Record<string, { count: number; pnl: number }> = {};
  closedTrades.forEach(t => {
    const reason = t.exit_reason || 'UNKNOWN';
    const cleanReason = reason.split(':')[0].trim();
    if (!exitReasons[cleanReason]) exitReasons[cleanReason] = { count: 0, pnl: 0 };
    exitReasons[cleanReason].count++;
    exitReasons[cleanReason].pnl += (parseFloat(t.realized_pnl) || 0);
  });

  // Group by side
  const longs = closedTrades.filter(t => t.position_side === 'LONG');
  const shorts = closedTrades.filter(t => t.position_side === 'SHORT');
  const longPnL = longs.reduce((acc, t) => acc + (parseFloat(t.realized_pnl) || 0), 0);
  const shortPnL = shorts.reduce((acc, t) => acc + (parseFloat(t.realized_pnl) || 0), 0);
  const longWins = longs.filter(t => (t.realized_pnl || 0) > 0).length;
  const shortWins = shorts.filter(t => (t.realized_pnl || 0) > 0).length;

  // Group by symbol
  const symbolStats: Record<string, { trades: number; wins: number; pnl: number }> = {};
  closedTrades.forEach(t => {
    if (!symbolStats[t.symbol]) symbolStats[t.symbol] = { trades: 0, wins: 0, pnl: 0 };
    symbolStats[t.symbol].trades++;
    if ((t.realized_pnl || 0) > 0) symbolStats[t.symbol].wins++;
    symbolStats[t.symbol].pnl += (parseFloat(t.realized_pnl) || 0);
  });

  const summary = {
    totalTrades,
    closedCount: closedTrades.length,
    openCount: openTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: winRate.toFixed(2) + '%',
    totalPnL: totalPnL.toFixed(4),
    grossPnL: grossPnL.toFixed(4),
    totalFees: totalFees.toFixed(4),
    profitFactor: profitFactor.toFixed(2),
    avgWin: avgWin.toFixed(4),
    avgLoss: avgLoss.toFixed(4),
    expectancy: expectancy.toFixed(4),
    exitReasons,
    sideBreakdown: {
      longs: { count: longs.length, wins: longWins, winRate: longs.length ? (longWins / longs.length * 100).toFixed(1) + '%' : '0%', pnl: longPnL.toFixed(4) },
      shorts: { count: shorts.length, wins: shortWins, winRate: shorts.length ? (shortWins / shorts.length * 100).toFixed(1) + '%' : '0%', pnl: shortPnL.toFixed(4) }
    },
    topLosingCoins: Object.entries(symbolStats).sort((a, b) => a[1].pnl - b[1].pnl).slice(0, 10),
    topWinningCoins: Object.entries(symbolStats).sort((a, b) => b[1].pnl - a[1].pnl).slice(0, 10),
  };

  console.log('--- SUMMARY ---');
  console.log(JSON.stringify(summary, null, 2));

  fs.writeFileSync('scripts/trades_dump.json', JSON.stringify({ summary, status, trades, signals }, null, 2));
}

analyze().catch(console.error);
