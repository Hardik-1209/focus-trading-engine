import dotenv from 'dotenv';
dotenv.config();

async function inspect() {
  const token = process.env.supabase_accesss_token;
  const res = await fetch('https://api.supabase.com/v1/projects/hnruqahncdniwyirgorh/database/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;`
    })
  });
  const cols = await res.json() as any[];
  const map: Record<string, string[]> = {};
  for (const c of cols) {
    if (!map[c.table_name]) map[c.table_name] = [];
    map[c.table_name].push(`${c.column_name} (${c.data_type})`);
  }
  console.log(JSON.stringify(map, null, 2));
}

inspect().catch(console.error);
