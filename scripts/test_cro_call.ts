import dotenv from 'dotenv';
dotenv.config();

async function testJson() {
  const key = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  const system =
    'You are an uncompromising, skeptical Chief Risk Officer (CRO) at a multi-million dollar quantitative crypto fund. ' +
    'Your default answer is VETO. Return ONLY valid JSON matching this schema: ' +
    '{"verdict": "APPROVE" | "VETO", "confidence": number, "disqualifiers": string[], "reasoning": string}.';

  const user =
    'Evaluate candidate: Long LSKUSDT at $0.1542, 5m RSI 68.5, 15m CHOP 58.2, planned RR 1.4:1. ' +
    'Return JSON object.';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.05,
      max_tokens: 600,
    }),
  });

  console.log('HTTP Status:', res.status);
  const data = await res.json() as any;
  console.log('Full JSON response:', JSON.stringify(data, null, 2));
}

testJson().catch(console.error);
