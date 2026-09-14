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
  console.log(`Testing all 6 keys on gemini-3.5-flash...`);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(8000),
      });
      const d = await res.json() as any;
      if (res.ok) {
        console.log(`✅ Key #${i + 1} (${key.slice(0, 8)}...): 200 OK in ${Date.now() - start}ms`);
      } else {
        console.log(`❌ Key #${i + 1} (${key.slice(0, 8)}...): HTTP ${res.status} -> ${d?.error?.message?.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`⚠️ Key #${i + 1}: Exception ${e.message}`);
    }
  }
}
run();
