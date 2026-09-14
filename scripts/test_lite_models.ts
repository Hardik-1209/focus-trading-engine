import dotenv from 'dotenv';
dotenv.config();

const key = process.env.gemini_api_key!;
const models = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function run() {
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(6000),
      });
      const d = await res.json() as any;
      if (res.ok) {
        console.log(`[${m}] 200 OK! Model version: ${d.modelVersion}`);
      } else {
        console.log(`[${m}] ${res.status}: ${d.error?.message?.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`[${m}] Exception: ${e.message}`);
    }
  }
}
run();
