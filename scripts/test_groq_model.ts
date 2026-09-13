import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  console.log('Testing Groq with model:', model);

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: 'Say hello in 5 words' }],
      max_tokens: 20,
    }),
  });

  console.log('HTTP Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);

  // Let's also fetch list of available models on Groq
  const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` }
  });
  const modelsData = await modelsRes.json() as any;
  console.log('\nAvailable models on Groq:');
  for (const m of modelsData.data || []) {
    console.log(`- ${m.id}`);
  }
}

main().catch(console.error);
