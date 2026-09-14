import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const token = process.env.render_api_key;
  const serviceId = 'srv-daiqktlg1s2s738d56ag';
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/logs?limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error('Failed to get logs:', res.status, await res.text());
    return;
  }
  const json = await res.json() as any;
  console.log('Logs:');
  const lines = Array.isArray(json) ? json : (json.logs || []);
  for (const l of lines.slice(-30)) {
    console.log(l.message || l.text || JSON.stringify(l));
  }
}
run();
