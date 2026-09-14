import dotenv from 'dotenv';
dotenv.config();

const key = process.env.gemini_api_key!;
const model = 'gemini-3.5-flash-lite';

async function run() {
  console.log(`Sending 25 requests to ${model} on Key #1 to verify quota limits...`);
  let successCount = 0;
  for (let i = 1; i <= 25; i++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond "OK"' }] }],
          generationConfig: { maxOutputTokens: 5 }
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        successCount++;
        process.stdout.write(`.` );
      } else {
        const d = await res.json() as any;
        console.log(`\n❌ Req #${i} Failed (${res.status}): ${d?.error?.message}`);
        break;
      }
    } catch (e: any) {
      console.log(`\n⚠️ Req #${i} Exception: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200)); // small delay
  }
  console.log(`\nFinished: ${successCount}/25 successful on Key #1.`);
}
run();
