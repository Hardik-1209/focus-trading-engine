import dotenv from 'dotenv';
dotenv.config();

async function setRenderEnvAndDeploy() {
  const token = process.env.render_api_key;
  const serviceId = 'srv-daiqktlg1s2s738d56ag';

  if (!token) {
    throw new Error('Missing render_api_key in .env');
  }

  const envVars = [
    { key: 'PORT', value: '10000' },
    { key: 'NODE_ENV', value: 'production' },
    { key: 'SUPABASE_URL', value: process.env.SUPABASE_URL || '' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY || '' },
    { key: 'BITGET_API_KEY', value: process.env.BITGET_API_KEY || '' },
    { key: 'BITGET_SECRET_KEY', value: process.env.BITGET_SECRET_KEY || '' },
    { key: 'BITGET_PASSPHRASE', value: process.env.BITGET_PASSPHRASE || '' },
    { key: 'GROQ_MODEL', value: process.env.GROQ_MODEL || 'openai/gpt-oss-20b' },
    { key: 'GROQ_API_KEY', value: process.env.GROQ_API_KEY || '' },
    { key: 'GROQ_API_KEY2', value: process.env.GROQ_API_KEY2 || '' },
    { key: 'GROQ_API_KEY3', value: process.env.GROQ_API_KEY3 || '' },
    { key: 'GROQ_API_KEY4', value: process.env.GROQ_API_KEY4 || '' },
    { key: 'GROQ_API_KEY5', value: process.env.GROQ_API_KEY5 || '' },
    { key: 'WATCH_DURATION_MINUTES', value: '30' },
    { key: 'DRY_RUN', value: 'true' },
    { key: 'MIN_VOLUME_USDT', value: '500000' },
    { key: 'VITE_SUPABASE_URL', value: process.env.SUPABASE_URL || '' },
    { key: 'VITE_SUPABASE_ANON_KEY', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucnVxYWhuY2RuaXd5aXJnb3JoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NTU3NzksImV4cCI6MjA5NTEzMTc3OX0.q8Ujxv8I9QFYB2ibvvzgEiORtblb8btdNya6GEJm6eg' },
  ];

  console.log(`[Render] Updating environment variables for service ${serviceId}...`);
  const putRes = await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(envVars),
  });

  const putData = await putRes.json();
  if (putRes.ok) {
    console.log('✅ [Render] Environment variables updated successfully!');
  } else {
    console.error('❌ [Render] Failed to update env vars:', putData);
    return;
  }

  // Trigger a fresh deployment
  console.log('[Render] Triggering fresh deployment...');
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
  console.log('🚀 [Render] Deployment started! Deploy ID:', deployId);
  console.log('[Render] Monitoring build and deployment progress...');

  let attempts = 0;
  while (attempts < 60) {
    await new Promise(r => setTimeout(r, 10000));
    attempts++;

    try {
      const checkRes = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const checkData = await checkRes.json() as any;
      const status = checkData?.status;
      console.log(`[Render] Elapsed: ${attempts * 10}s | Status: ${status}`);

      if (status === 'live') {
        console.log('🎉 [Render] Deployment is LIVE!');
        break;
      } else if (status === 'build_failed' || status === 'update_failed' || status === 'canceled') {
        console.error(`❌ [Render] Deployment ended with status: ${status}`);
        break;
      }
    } catch (e: any) {
      console.warn('[Render] Polling warning:', e.message);
    }
  }

  // Ping the live health endpoint
  console.log('\n[Health Check] Testing https://focus-trading-engine.onrender.com/health...');
  try {
    const healthRes = await fetch('https://focus-trading-engine.onrender.com/health');
    const healthData = await healthRes.json();
    console.log('✅ [Health Check] Live Service Telemetry:');
    console.log(JSON.stringify(healthData, null, 2));
  } catch (err: any) {
    console.log('⚠️ [Health Check] Service is still spinning up:', err.message);
  }
}

setRenderEnvAndDeploy().catch(console.error);
