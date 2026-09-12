import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

async function cleanDatabase() {
  console.log('Connecting to Supabase to clean all old data...');
  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Delete all trades
  console.log('Clearing futures_trades table...');
  const { error: err1 } = await supabase
    .from('futures_trades')
    .delete()
    .not('id', 'is', null);
  if (err1) console.error('Error clearing trades:', err1.message);
  else console.log('✅ futures_trades cleared.');

  // 2. Delete all health events
  console.log('Clearing system_health_events table...');
  const { error: err2 } = await supabase
    .from('system_health_events')
    .delete()
    .not('id', 'is', null);
  if (err2) console.error('Error clearing health events:', err2.message);
  else console.log('✅ system_health_events cleared.');

  // 2b. Delete all focus events
  console.log('Clearing focus_events table...');
  const { error: errEvents } = await supabase
    .from('focus_events')
    .delete()
    .not('id', 'is', null);
  if (errEvents) console.error('Error clearing focus events:', errEvents.message);
  else console.log('✅ focus_events cleared.');

  // 3. Reset virtual wallet
  console.log('Resetting virtual_wallet to $10.00...');
  const { error: err3 } = await supabase
    .from('virtual_wallet')
    .delete()
    .not('id', 'is', null);
  
  if (err3) {
    console.error('Error clearing wallet:', err3.message);
  } else {
    // Insert fresh wallet
    const { error: err4 } = await supabase
      .from('virtual_wallet')
      .insert({ balance: 10.00 });
    if (err4) console.error('Error creating new wallet:', err4.message);
    else console.log('✅ virtual_wallet reset to $10.00.');
  }

  console.log('\n🎉 Database completely cleaned and ready for fresh data!');
}

cleanDatabase().catch(console.error);
