import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase
    .from('system_health_events')
    .select('*')
    .eq('component', 'focus-engine')
    .order('timestamp', { ascending: false })
    .limit(5);
  console.log("Error:", error);
  console.log("Data count:", data ? data.length : 0);
  if (data && data.length > 0) {
    console.log("Sample data[0]:", JSON.stringify(data[0], null, 2));
    console.log("Sample data[1]:", JSON.stringify(data[1], null, 2));
  }
}
test();
