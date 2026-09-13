import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: sessions } = await supabase.from('trading_sessions').select('*');
  console.log('Sessions count:', sessions?.length);
  console.log('Sessions:', sessions);

  const { count: unarchived } = await supabase.from('futures_trades').select('*', { count: 'exact', head: true }).or('is_archived.is.null,is_archived.eq.false');
  const { count: total } = await supabase.from('futures_trades').select('*', { count: 'exact', head: true });
  console.log('Trades: total =', total, ', unarchived =', unarchived);

  const { data: wallet } = await supabase.from('virtual_wallet').select('*');
  console.log('Wallet:', wallet);

  const { data: engine } = await supabase.from('engine_status').select('*');
  console.log('Engine status:', engine);
}

main().catch(console.error);
