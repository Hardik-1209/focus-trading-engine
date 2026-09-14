import dotenv from 'dotenv';
dotenv.config();

const key = process.env.gemini_api_key!;

const candidateModels = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
];

async function run() {
  console.log(`Checking quotas for key #1 across candidate models...`);
  for (const m of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(8000),
      });

      const body = await res.json() as any;
      if (res.ok) {
        console.log(`✅ [${m}] Status: 200 OK! Candidates:`, body?.candidates ? 'YES' : 'NO');
      } else {
        const violation = body?.error?.details?.find((d: any) => d['@type']?.includes('QuotaFailure'))?.violations?.[0];
        console.log(`❌ [${m}] Status: ${res.status} | Quota: ${violation?.quotaId} | Limit: ${violation?.quotaValue} | Msg: ${body?.error?.message?.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`⚠️ [${m}] Exception: ${e.message}`);
    }
  }
}
run();
