import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function cleanSlateDatabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabase = createClient(url, key);

  console.log('🧹 [Clean Slate] Starting complete database purge of old test data...\n');

  // 1. Delete all records from futures_trades
  console.log('1. Purging futures_trades...');
  const { error: ftErr } = await supabase.from('futures_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (ftErr) console.warn('   ⚠️ futures_trades error:', ftErr.message);
  else console.log('   ✅ All futures_trades wiped clean.');

  // 2. Delete all records from market_signals
  console.log('2. Purging market_signals...');
  const { error: msErr } = await supabase.from('market_signals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (msErr) console.warn('   ⚠️ market_signals error:', msErr.message);
  else console.log('   ✅ All market_signals wiped clean.');

  // 3. Delete old health events
  console.log('3. Purging system_health_events...');
  const { error: shErr } = await supabase.from('system_health_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (shErr) console.warn('   ⚠️ system_health_events error:', shErr.message);
  else console.log('   ✅ All system_health_events wiped clean.');

  // 4. Reset virtual wallet to $10.00 USDT baseline
  console.log('4. Resetting virtual_wallet to $10.00 USDT (₹885.00 INR)...');
  const { data: existingWallet } = await supabase.from('virtual_wallet').select('id').limit(1);
  if (existingWallet && existingWallet.length > 0) {
    await supabase.from('virtual_wallet').update({
      balance: 10.00,
      updated_at: new Date().toISOString(),
    }).eq('id', existingWallet[0].id);
  } else {
    await supabase.from('virtual_wallet').insert({
      id: '00000000-0000-0000-0000-000000000001',
      balance: 10.00,
      updated_at: new Date().toISOString(),
    });
  }
  console.log('   ✅ virtual_wallet set to 10.00 USDT.');

  // 5. Reset engine_status
  console.log('5. Resetting engine_status...');
  await supabase.from('engine_status').upsert({
    id: 'primary',
    last_heartbeat: new Date().toISOString(),
    is_running: true,
    focused_symbol: 'Scanning...',
    cycle_count: 1,
    active_trades_count: 0,
    active_groq_key_index: 0,
    total_pnl: 0.00,
    win_rate: 0.00,
    mode: 'DRY_RUN',
    updated_at: new Date().toISOString(),
  });
  console.log('   ✅ engine_status reset to 0 trades, $0.00 PnL.');

  // 6. Verify final record counts
  console.log('\n📊 Verifying clean database state:');
  const [cTrades, cSignals, cHealth, cWallet] = await Promise.all([
    supabase.from('futures_trades').select('*', { count: 'exact', head: true }),
    supabase.from('market_signals').select('*', { count: 'exact', head: true }),
    supabase.from('system_health_events').select('*', { count: 'exact', head: true }),
    supabase.from('virtual_wallet').select('balance').single(),
  ]);

  console.log(`- futures_trades count: ${cTrades.count}`);
  console.log(`- market_signals count: ${cSignals.count}`);
  console.log(`- system_health_events count: ${cHealth.count}`);
  console.log(`- virtual_wallet balance: $${cWallet.data?.balance} USDT (₹${(Number(cWallet.data?.balance) * 88.5).toFixed(2)})`);
  console.log('\n✨ Database purge & clean slate complete!');
}

cleanSlateDatabase().catch(console.error);
