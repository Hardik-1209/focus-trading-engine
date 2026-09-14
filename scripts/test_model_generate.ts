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

const testModels = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro'];

async function run() {
  for (const model of testModels) {
    console.log(`\n--- Testing model: ${model} ---`);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const start = Date.now();
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with OK' }] }],
            generationConfig: { maxOutputTokens: 5 }
          }),
          signal: AbortSignal.timeout(6000),
        });
        const text = await res.text();
        console.log(`Key #${i + 1} (${key.slice(0, 8)}...): HTTP ${res.status} in ${Date.now() - start}ms -> ${text.slice(0, 70)}`);
      } catch (err: any) {
        console.log(`Key #${i + 1} (${key.slice(0, 8)}...): Error in ${Date.now() - start}ms -> ${err.message}`);
      }
    }
  }
}
run();
