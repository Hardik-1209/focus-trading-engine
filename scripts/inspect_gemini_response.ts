import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const key = process.env.gemini_api_key3;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Give a JSON object: {"verdict": "APPROVED"}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    }),
  });
  const d = await res.json() as any;
  console.log('Response:');
  console.log(JSON.stringify(d, null, 2));
}
run();
