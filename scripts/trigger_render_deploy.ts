import dotenv from 'dotenv';
dotenv.config();

async function triggerDeploy() {
  const token = process.env.render_api_key;
  const serviceId = 'srv-daiqktlg1s2s738d56ag';

  if (!token) {
    throw new Error('Missing render_api_key in .env');
  }

  console.log(`🚀 [Render] Triggering fresh deployment of latest GitHub main commit (342b521) for service ${serviceId}...`);
  const depRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ clearCache: 'clear' }),
  });

  const depData = await depRes.json() as any;
  if (!depRes.ok) {
    console.error('❌ [Render] Failed to trigger deploy:', depData);
    return;
  }

  const deployId = depData.id;
  console.log(`✅ [Render] Deployment triggered successfully! Deploy ID: ${deployId}`);
  console.log('⏳ [Render] Monitoring build and deployment progress...');

  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 8000));
    attempts++;

    try {
      const checkRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const checkData = await checkRes.json() as any;
      const status = checkData?.status;
      const commitMsg = checkData?.commit?.message || '';
      console.log(`[Render] Elapsed: ${attempts * 8}s | Status: ${status} | Commit: ${checkData?.commit?.id?.slice(0, 7) || ''} (${commitMsg.slice(0, 45)})`);

      if (status === 'live') {
        console.log('\n🎉 [Render] Deployment is LIVE and serving traffic!');
        break;
      } else if (status === 'build_failed' || status === 'update_failed' || status === 'canceled') {
        console.error(`❌ [Render] Deployment failed with status: ${status}`);
        break;
      }
    } catch (e: any) {
      console.warn('[Render] Polling error:', e.message);
    }
  }

  // Health check
  console.log('\n[Health Check] Testing https://focus-trading-engine.onrender.com/health...');
  await new Promise(r => setTimeout(r, 3000));
  try {
    const healthRes = await fetch('https://focus-trading-engine.onrender.com/health', { signal: AbortSignal.timeout(10000) });
    const healthData = await healthRes.json();
    console.log('✅ [Health Check] Live Service Telemetry:');
    console.log(JSON.stringify(healthData, null, 2));
  } catch (err: any) {
    console.log('⚠️ [Health Check] Notice:', err.message);
  }
}

triggerDeploy().catch(console.error);
