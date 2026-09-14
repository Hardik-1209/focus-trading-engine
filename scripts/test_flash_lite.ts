import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const models = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3-flash-preview'];
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${process.env.gemini_api_key}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Return JSON: {"hello": "world"}' }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 20 }
        }),
        signal: AbortSignal.timeout(10000),
      });
      const d = await res.json() as any;
      if (res.ok) {
        console.log(`✅ [${m}] 200 OK in ${Date.now() - start}ms:`, d.candidates?.[0]?.content?.parts?.[0]?.text);
      } else {
        console.log(`❌ [${m}] ${res.status}:`, d.error?.message?.slice(0, 100));
      }
    } catch (e: any) {
      console.log(`⚠️ [${m}] Exception: ${e.message}`);
    }
  }
}
run();
