import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const s = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data } = await s
    .from('system_health_events')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(15);
  console.log('Recent health events:');
  for (const e of data || []) {
    console.log(`[${e.timestamp}] [${e.severity}] ${e.component}: ${e.message}`);
  }
}
run();
