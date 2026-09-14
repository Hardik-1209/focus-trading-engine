import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + process.env.gemini_api_key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] })
  });
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('Body:', JSON.stringify(json, null, 2));
}
run();
