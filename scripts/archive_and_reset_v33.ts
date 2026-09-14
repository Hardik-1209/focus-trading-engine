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

async function archiveAndResetV33() {
  console.log('?? Starting v3.3 Clean Slate Reset & Archive...');
  const now = new Date().toISOString();

  // 1. Fetch unarchived trades
  const { data: activeTrades, error: tradesErr } = await supabase
    .from('futures_trades')
    .select('*')
    .or('is_archived.is.null,is_archived.eq.false')
    .order('created_at', { ascending: true });

  if (tradesErr) {
    console.error('Error fetching unarchived trades:', tradesErr);
    process.exit(1);
  }

  const tradeCount = activeTrades?.length || 0;
  console.log('Found ' + tradeCount + ' unarchived trades to archive.');

  let totalPnl = 0;
  let wins = 0;
  for (const t of activeTrades || []) {
    const pnl = parseFloat(t.realized_pnl || '0');
    totalPnl += pnl;
    if (pnl > 0) wins++;
  }
  const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

  // 2. Archive previous active session
  const prevSessionId = 'session_v32_eval';
  console.log('Archiving ' + tradeCount + ' trades under session ' + prevSessionId + '...');
  await supabase.from('trading_sessions').upsert({
    id: prevSessionId,
    name: 'v3.2 Evaluation Session (' + tradeCount + ' Trades)',
    created_at: activeTrades && activeTrades.length > 0 && activeTrades[0].created_at ? activeTrades[0].created_at : now,
    initial_balance: 10.00,
    final_balance: parseFloat((10.00 + totalPnl).toFixed(4)),
    total_trades: tradeCount,
    win_rate: parseFloat(winRate.toFixed(2)),
    total_pnl: parseFloat(totalPnl.toFixed(4)),
    is_active: false,
  });

  // Mark all unarchived trades as archived and close any hanging open positions
  const { error: updateTradesErr } = await supabase
    .from('futures_trades')
    .update({
      is_archived: true,
      status: 'CLOSED',
      exit_reason: 'SESSION_RESET_V33',
    })
    .or('is_archived.is.null,is_archived.eq.false');

  if (updateTradesErr) {
    console.error('Error archiving trades:', updateTradesErr);
  } else {
    console.log('✅ All ' + tradeCount + ' trades marked as archived.');
  }

  // 3. Mark all older sessions as is_active = false
  await supabase
    .from('trading_sessions')
    .update({ is_active: false })
    .neq('id', 'dummy');

  // 4. Create new Active v3.3 session record
  const v33SessionId = 'session_v33_active';
  console.log('Creating new active v3.3 session in trading_sessions...');
  const { error: v33SessionErr } = await supabase.from('trading_sessions').upsert({
    id: v33SessionId,
    name: 'v3.3 Autonomous Quant Trader Session (Active)',
    created_at: now,
    initial_balance: 10.00,
    final_balance: 10.00,
    total_trades: 0,
    win_rate: 0.00,
    total_pnl: 0.00,
    is_active: true,
  });

  if (v33SessionErr) {
    console.error('Error creating v3.3 session:', v33SessionErr);
  } else {
    console.log('? v3.3 active session record created.');
  }

  // 5. Reset virtual wallet to .00 USDT
  console.log('Resetting virtual_wallet to .00 USDT baseline...');
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
    console.log('? virtual_wallet balance reset to .00 USDT.');
  }

  // 6. Reset engine_status
  console.log('Resetting engine_status to cycle 1, .00 PnL, v3.3 metadata...');
  const { error: engineErr } = await supabase.from('engine_status').upsert({
    id: 'primary',
    last_heartbeat: now,
    is_running: true,
    focused_symbol: 'Scanning (v3.3 Multi-Timeframe Intraday)...',
    cycle_count: 1,
    active_trades_count: 0,
    win_rate: 0.00,
    total_pnl: 0.00,
    active_groq_key_index: 0,
    mode: 'DRY_RUN (v3.3)',
    updated_at: now,
    live_indicators: {
      price: 0,
      regime: 'ACTIVE_CONCURRENT_SCAN',
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
        version: '3.3.0',
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
  console.log('- Unarchived active trades in UI: ' + unarchivedCount + ' (Should be 0)');
  console.log('- Archived trades in history: ' + archivedCount + ' (Available in dropdown)');
  console.log('- Active virtual wallet: $' + finalWallet?.balance + ' USDT');
  console.log('\n🎉 Successfully reset to Clean Slate v3.3!');
}

archiveAndResetV33().catch(console.error);
