import dotenv from 'dotenv';
dotenv.config();

async function runSql(sql: string) {
  const token = process.env.supabase_accesss_token;
  const res = await fetch('https://api.supabase.com/v1/projects/hnruqahncdniwyirgorh/database/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SQL Query failed (${res.status}): ${txt}`);
  }
  return await res.json();
}

async function main() {
  console.log('⚡ Executing Archive and Reset via direct PostgreSQL SQL endpoint...');

  const sql = `
    -- 1. Archive all existing trades
    UPDATE futures_trades
    SET is_archived = true, session_id = 'session_v2_baseline_24h'
    WHERE is_archived IS NULL OR is_archived = false;

    -- 2. Upsert historical session v2.0
    INSERT INTO trading_sessions (id, name, created_at, initial_balance, final_balance, total_trades, win_rate, total_pnl, is_active)
    VALUES (
      'session_v2_baseline_24h',
      'v2.0 24h Baseline Simulation (215 Trades)',
      '2026-09-12T17:00:00.000Z',
      10.00,
      8.6052,
      215,
      38.60,
      -1.3948,
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      final_balance = EXCLUDED.final_balance,
      total_trades = EXCLUDED.total_trades,
      win_rate = EXCLUDED.win_rate,
      total_pnl = EXCLUDED.total_pnl,
      is_active = false;

    -- 3. Upsert active session v3.0
    INSERT INTO trading_sessions (id, name, created_at, initial_balance, final_balance, total_trades, win_rate, total_pnl, is_active)
    VALUES (
      'session_v3_active',
      'v3.0 Institutional Quantitative Session (Active)',
      NOW(),
      10.00,
      10.00,
      0,
      0.00,
      0.00,
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      is_active = true;

    -- 4. Reset virtual wallet to $10.00 USDT
    UPDATE virtual_wallet
    SET balance = 10.00, updated_at = NOW();

    -- 5. Reset engine_status
    UPDATE engine_status
    SET
      cycle_count = 1,
      total_pnl = 0.00,
      win_rate = 0.00,
      active_trades_count = 0,
      focused_symbol = 'Scanning (v3.0)...',
      updated_at = NOW(),
      live_indicators = jsonb_build_object(
        'price', 0,
        'rsi', 50.0,
        'adx', 20.0,
        'chop', 45.0,
        'vwap', 0,
        'mtf', '15m REGIME SCANNING',
        'regime', 'ANALYZING',
        'atr', 0,
        'volZ', 0,
        'timestamp', NOW()::text,
        'risk_governor', jsonb_build_object(
          'dailyHalted', false,
          'dailyStartingBalance', 10.00,
          'dailyRealizedPnl', 0,
          'dailyDrawdownPct', 0,
          'activeCooldowns', '[]'::jsonb,
          'rollingExpectancy', 0,
          'rollingWinRate', 0,
          'llmTotalEvaluations', 0,
          'llmApprovals', 0,
          'llmApprovalRate', 0,
          'version', '3.0.0'
        )
      )
    WHERE id = 'primary';
  `;

  await runSql(sql);
  console.log('✅ Direct SQL execution succeeded!');

  // Verify
  const checkSql = `
    SELECT
      (SELECT COUNT(*) FROM futures_trades WHERE is_archived = false OR is_archived IS NULL) AS unarchived_trades,
      (SELECT COUNT(*) FROM futures_trades WHERE is_archived = true) AS archived_trades,
      (SELECT balance FROM virtual_wallet LIMIT 1) AS wallet_balance,
      (SELECT total_trades FROM trading_sessions WHERE id = 'session_v2_baseline_24h') AS v2_trades,
      (SELECT cycle_count FROM engine_status WHERE id = 'primary') AS engine_cycle;
  `;
  const result = await runSql(checkSql);
  console.log('\n📊 Database Status After SQL Execution:');
  console.log(result);
}

main().catch(console.error);
