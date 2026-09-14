import dotenv from 'dotenv';
dotenv.config();

const keys = [
  process.env.gemini_api_key,
  process.env.gemini_api_key2,
  process.env.gemini_api_key3,
  process.env.gemini_api_key4,
  process.env.gemini_api_key5,
  process.env.gemini_api_key6,
].filter(Boolean) as string[];

async function run() {
  console.log('Testing gemini-3.6-flash on all 6 keys...');
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(8000),
      });
      const text = await res.text();
      console.log(`Key #${i + 1} (${key.slice(0, 8)}...): HTTP ${res.status} in ${Date.now() - start}ms -> ${text.slice(0, 90)}`);
    } catch (err: any) {
      console.log(`Key #${i + 1} (${key.slice(0, 8)}...): Error in ${Date.now() - start}ms -> ${err.message}`);
    }
  }
}
run();
