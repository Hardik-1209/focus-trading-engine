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
  console.log(`Testing ${keys.length} Gemini keys...`);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: AbortSignal.timeout(10000),
      });

      const bodyText = await res.text();
      console.log(`\n=== Key #${i + 1} (${key.slice(0, 10)}...) ===`);
      console.log(`HTTP Status: ${res.status} ${res.statusText}`);
      console.log(`Response Body: ${bodyText}`);
    } catch (err: any) {
      console.log(`\n=== Key #${i + 1} === Exception: ${err.message}`);
    }
  }
}
run();
