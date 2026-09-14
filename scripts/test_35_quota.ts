import dotenv from 'dotenv';
dotenv.config();

const key = process.env.gemini_api_key2!; // Test on Key #2

async function run() {
  console.log('Testing gemini-3.5-flash quota metric on Key #2...');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Say hello' }] }],
      generationConfig: { maxOutputTokens: 10 }
    }),
  });
  const data = await res.json() as any;
  console.log('Status:', res.status, res.statusText);
  if (!res.ok) {
    console.log('Error:', JSON.stringify(data.error, null, 2));
  } else {
    console.log('Success! Candidates:', data.candidates?.length, 'Model Version:', data.modelVersion);
  }
}
run();
