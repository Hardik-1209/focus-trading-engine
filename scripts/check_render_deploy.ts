import dotenv from 'dotenv';
dotenv.config();

async function checkDeploy() {
  const token = process.env.render_api_key;
  const serviceId = 'srv-daiqktlg1s2s738d56ag';
  
  if (!token) {
    console.error('Missing render_api_key in .env');
    return;
  }

  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys?limit=5`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error(`Render API returned ${res.status}:`, await res.text());
    return;
  }

  const deploys = await res.json() as any[];
  console.log('Recent Render Deploys:');
  for (const item of deploys) {
    const d = item.deploy || item;
    console.log(`- ID: ${d.id}`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Commit: ${d.commit?.id?.slice(0, 7) || 'N/A'} - ${d.commit?.message?.slice(0, 60) || 'N/A'}`);
    console.log(`  Created: ${d.createdAt}`);
    console.log(`  Finished: ${d.finishedAt || 'In Progress'}`);
    console.log('----------------------------------------------------');
  }

  console.log('\n[Health Check] Testing https://focus-trading-engine.onrender.com/health ...');
  try {
    const healthRes = await fetch('https://focus-trading-engine.onrender.com/health', { signal: AbortSignal.timeout(8000) });
    const healthData = await healthRes.json();
    console.log('✅ Live Service Response:');
    console.log(JSON.stringify(healthData, null, 2));
  } catch (err: any) {
    console.log('⚠️ Health check notice:', err.message);
  }
}

checkDeploy().catch(console.error);
