import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function archiveAndReset() {
  console.log('🚀 Starting v3.0 Archive and Reset...');
  const now = new Date().toISOString();

  // 1. Fetch current trades
  const { data: allTrades, error: tradesErr } = await supabase
    .from('futures_trades')
    .select('*')
    .order('created_at', { ascending: true });

  if (tradesErr) {
    console.error('Error fetching trades:', tradesErr);
    process.exit(1);
  }

  const tradeCount = allTrades?.length || 0;
  console.log(`Found ${tradeCount} trades to archive.`);

  let totalPnl = 0;
  let wins = 0;
  for (const t of allTrades || []) {
    const pnl = parseFloat(t.realized_pnl || '0');
    totalPnl += pnl;
    if (pnl > 0) wins++;
  }
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

  // 2. Insert the historical v2.0 session record
  const v2SessionId = 'session_v2_baseline_24h';
  console.log('Archiving v2.0 session to trading_sessions...');
  const { error: sessionErr } = await supabase.from('trading_sessions').upsert({
    id: v2SessionId,
    name: 'v2.0 24h Baseline Simulation (215 Trades)',
    created_at: allTrades && allTrades.length > 0 && allTrades[0].created_at ? allTrades[0].created_at : '2026-09-12T17:00:00.000Z',
    initial_balance: 10.00,
    final_balance: parseFloat((10.00 + totalPnl).toFixed(4)),
    total_trades: tradeCount,
    win_rate: parseFloat(winRate.toFixed(2)),
    total_pnl: parseFloat(totalPnl.toFixed(4)),
    is_active: false,
  });

  if (sessionErr) {
    console.error('Error creating v2 session:', sessionErr);
  } else {
    console.log('✅ v2.0 session record created/updated successfully.');
  }

  // 3. Mark all existing trades as archived and link them to v2SessionId
  console.log('Marking trades as is_archived = true...');
  const { error: updateTradesErr } = await supabase
    .from('futures_trades')
    .update({
      is_archived: true,
      session_id: v2SessionId,
    })
    .or('is_archived.is.null,is_archived.eq.false');

  if (updateTradesErr) {
    console.error('Error archiving trades:', updateTradesErr);
  } else {
    console.log(`✅ All ${tradeCount} trades marked as archived with session_id = ${v2SessionId}.`);
  }

  // 4. Create new Active v3.0 session record
  const v3SessionId = 'session_v3_active';
  console.log('Creating new active v3.0 session in trading_sessions...');
  const { error: v3SessionErr } = await supabase.from('trading_sessions').upsert({
    id: v3SessionId,
    name: 'v3.0 Institutional Quantitative Session (Active)',
    created_at: now,
    initial_balance: 10.00,
    final_balance: 10.00,
    total_trades: 0,
    win_rate: 0.00,
    total_pnl: 0.00,
    is_active: true,
  });

  if (v3SessionErr) {
    console.error('Error creating v3 session:', v3SessionErr);
  } else {
    console.log('✅ v3.0 active session record created.');
  }

  // 5. Reset virtual wallet to $10.00 USDT
  console.log('Resetting virtual_wallet to $10.00 USDT baseline...');
  const { error: walletErr } = await supabase
    .from('virtual_wallet')
    .update({
      balance: 10.00,
      updated_at: now,
    })
    .neq('balance', -999999);

  if (walletErr) {
    console.error('Error resetting wallet:', walletErr);
  } else {
    console.log('✅ virtual_wallet balance reset to $10.00 USDT.');
  }

  // 6. Reset engine_status
  console.log('Resetting engine_status to cycle 1, $0.00 PnL, v3.0 metadata...');
  const { error: engineErr } = await supabase.from('engine_status').upsert({
    id: 'primary',
    last_heartbeat: now,
    is_running: true,
    focused_symbol: 'Scanning (v3.0)...',
    cycle_count: 1,
    active_trades_count: 0,
    win_rate: 0.00,
    total_pnl: 0.00,
    active_groq_key_index: 0,
    mode: 'DRY_RUN',
    updated_at: now,
    live_indicators: {
      price: 0,
      rsi: 50.0,
      adx: 20.0,
      chop: 45.0,
      vwap: 0,
      mtf: '15m REGIME SCANNING',
      regime: 'ANALYZING',
      atr: 0,
      volZ: 0,
      timestamp: now,
      risk_governor: {
        dailyHalted: false,
        dailyStartingBalance: 10.00,
        dailyRealizedPnl: 0,
        dailyDrawdownPct: 0,
        activeCooldowns: [],
        rollingExpectancy: 0,
        rollingWinRate: 0,
        llmTotalEvaluations: 0,
        llmApprovals: 0,
        llmApprovalRate: 0,
        version: '3.0.0',
      },
    },
  });

  if (engineErr) {
    console.error('Error resetting engine status:', engineErr);
  } else {
    console.log('✅ engine_status reset to clean cycle 1.');
  }

  // 7. Verify counts
  const { count: unarchivedCount } = await supabase
    .from('futures_trades')
    .select('*', { count: 'exact', head: true })
    .or('is_archived.is.null,is_archived.eq.false');

  const { count: archivedCount } = await supabase
    .from('futures_trades')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', true);

  const { data: finalWallet } = await supabase.from('virtual_wallet').select('balance').single();

  console.log('\n📊 Final Verification:');
  console.log(`- Unarchived active trades in UI: ${unarchivedCount} (Should be 0)`);
  console.log(`- Archived trades in history: ${archivedCount} (Available in dropdown)`);
  console.log(`- Active virtual wallet: $${finalWallet?.balance} USDT`);
  console.log('\n🎉 Successfully reset to Clean Slate v3.0!');
}

archiveAndReset().catch(console.error);
