import dotenv from 'dotenv';
dotenv.config();

async function testGemini36() {
  const keys = [
    process.env.gemini_api_key,
    process.env.gemini_api_key2,
    process.env.gemini_api_key3,
    process.env.gemini_api_key4,
    process.env.gemini_api_key5,
    process.env.gemini_api_key6,
  ].filter(Boolean) as string[];

  console.log(`Testing with models/gemini-3.6-flash across ${keys.length} keys:`);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello! Respond with: "Gemini 3.6 Flash Active"' }] }]
      })
    });

    if (res.ok) {
      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      console.log(`✅ Key #${i + 1} (${key.slice(0, 10)}...): SUCCESS! Response: "${text}"`);
    } else {
      console.log(`⚠️ Key #${i + 1}: HTTP ${res.status} - ${await res.text()}`);
    }
  }
}

testGemini36().catch(console.error);
