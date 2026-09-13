/**
 * gemini-client.ts (v3.1)
 * Primary Cloud LLM Engine — Google Gemini 3.6 Flash
 * 6-Key Round-Robin Rotation Array with 60s Rate-Limit Cooldown & Passive Telemetry.
 */
import { CONFIG } from './config';
import type { RiskParams, RiskVerdict, NarrativeScore } from './groq-client';

// Key usage & health tracker
let currentGeminiKeyIndex = 0;
const geminiKeyUsage: Map<string, number> = new Map();
const geminiRateLimitedKeys: Map<string, number> = new Map();
const geminiKeyErrors: Map<string, string> = new Map();
const geminiKeyLatency: Map<string, number> = new Map();

/** Get current active Gemini key with round-robin rotation & cooldown bypass */
export function getNextGeminiKey(): { key: string; index: number } {
  if (CONFIG.GEMINI_KEYS.length === 0) {
    throw new Error('No Gemini API keys configured');
  }

  const now = Date.now();
  const total = CONFIG.GEMINI_KEYS.length;

  for (let i = 0; i < total; i++) {
    const idx = (currentGeminiKeyIndex + i) % total;
    const key = CONFIG.GEMINI_KEYS[idx];
    const cooldownUntil = geminiRateLimitedKeys.get(key) || 0;

    if (now >= cooldownUntil) {
      currentGeminiKeyIndex = (idx + 1) % total;
      return { key, index: idx };
    }
  }

  // All keys in cooldown — pick the one that expires earliest
  let earliestKey = CONFIG.GEMINI_KEYS[0];
  let earliestIdx = 0;
  let minWait = Infinity;

  for (let i = 0; i < total; i++) {
    const key = CONFIG.GEMINI_KEYS[i];
    const cooldownUntil = geminiRateLimitedKeys.get(key) || 0;
    if (cooldownUntil < minWait) {
      minWait = cooldownUntil;
      earliestKey = key;
      earliestIdx = i;
    }
  }

  console.warn(`[Gemini] All 6 keys in cooldown. Earliest key #${earliestIdx + 1} unlocks in ${Math.max(0, Math.round((minWait - now) / 1000))}s`);
  return { key: earliestKey, index: earliestIdx };
}

/** Clean JSON response text */
function parseJsonClean(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/** Call Gemini 3.6 Flash generateContent with automatic key rotation */
async function callGeminiWithRotation(system: string, userPrompt: string, timeoutMs = 8000): Promise<any> {
  const maxAttempts = Math.min(CONFIG.GEMINI_KEYS.length, 3);
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, index } = getNextGeminiKey();
    const startTime = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${key}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 800,
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      const elapsed = Date.now() - startTime;
      geminiKeyLatency.set(key, elapsed);

      if (res.status === 429) {
        console.warn(`[Gemini] Key #${index + 1} rate-limited (429). Rotating to next key...`);
        geminiRateLimitedKeys.set(key, Date.now() + 60000);
        geminiKeyErrors.set(key, 'Rate limit (429)');
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        geminiKeyErrors.set(key, `HTTP ${res.status}`);
        throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as any;
      const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) throw new Error('Empty response from Gemini');

      // Record successful usage
      geminiKeyUsage.set(key, (geminiKeyUsage.get(key) || 0) + 1);
      geminiKeyErrors.delete(key);

      return parseJsonClean(content);
    } catch (err: any) {
      lastError = err;
      geminiKeyErrors.set(key, err.message || 'Call failed');
      console.warn(`[Gemini] Attempt ${attempt + 1} with key #${index + 1} failed: ${err.message}`);
    }
  }

  throw lastError || new Error('All Gemini keys failed');
}

/**
 * v3.1 Primary Adversarial Chief Risk Officer (CRO) Gatekeeper — Gemini 3.6 Flash
 * Strict 5-point disqualification audit of trend pullback entries.
 */
export async function evaluateRiskVerdictWithGemini(params: RiskParams): Promise<RiskVerdict> {
  const system =
    'You are an uncompromising, skeptical Chief Risk Officer (CRO) at a multi-million dollar quantitative crypto hedge fund. ' +
    'Your sole mission is to PROTECT CAPITAL by rejecting fragile, low-edge, or crowded trade setups. ' +
    'Your default answer is VETO. You only APPROVE when a setup possesses exceptional multi-timeframe confluence and clear edge. ' +
    'Strictly reject candidate trades if ANY of the following 5 disqualifiers are present:\n' +
    '1. EXHAUSTION: For LONG: 5m RSI > 66 or price extended far above VWAP. For SHORT: 5m RSI < 34 or price far below VWAP.\n' +
    '2. FAKE BREAKOUT / WEAK VOLUME: 5m Volume Z-score < 0.8 or volume contracting.\n' +
    '3. RISK-TO-REWARD DEFICIT: Planned Reward:Risk is below 1.6:1.\n' +
    '4. CROWDING / DERIVATIVES RISK: Extreme funding rate (> +0.02% for longs or < -0.02% for shorts indicates squeeze trap danger).\n' +
    '5. CHOPPY REGIME: 15m CHOP > 58 or ADX < 20 indicates sideways trend exhaustion.\n\n' +
    'Return ONLY valid JSON matching this schema:\n' +
    '{\n' +
    '  "verdict": "APPROVE" | "VETO",\n' +
    '  "confidence": number (0-100),\n' +
    '  "disqualifiers": string[],\n' +
    '  "reasoning": string\n' +
    '}';

  const user =
    `Asset: ${params.symbol}\n` +
    `Direction: ${params.action}\n` +
    `Current Price: ${params.technicalBlock.currentPrice}\n` +
    `Planned Stop Loss: ${params.stopLossPrice} | Planned Take Profit: ${params.takeProfitPrice}\n` +
    `Planned Reward:Risk Ratio: ${params.plannedRR.toFixed(2)}:1\n` +
    `Funding Rate: ${params.fundingRate !== undefined ? (params.fundingRate * 100).toFixed(4) + '%' : 'Neutral'}\n` +
    `15m Macro Regime: ${params.technicalBlock.regime15m} | 15m ADX: ${params.technicalBlock.adx15m.toFixed(1)} | 15m CHOP: ${params.technicalBlock.chop15m.toFixed(1)}\n` +
    `5m Execution: RSI: ${params.technicalBlock.rsi5m.toFixed(1)} | VWAP: ${params.technicalBlock.vwap5m} | Volume Z-Score: ${params.technicalBlock.volumeZ5m.toFixed(2)} | ATR: ${params.technicalBlock.atr5m}\n\n` +
    `Conduct your adversarial audit. Disqualify if fragile or crowded. Return JSON.`;

  const parsed = await callGeminiWithRotation(system, user, 8000);

  const verdict = (parsed.verdict === 'APPROVE' ? 'APPROVE' : 'VETO') as 'APPROVE' | 'VETO';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50;
  const disqualifiers = Array.isArray(parsed.disqualifiers) ? parsed.disqualifiers : [];
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Gemini evaluated risk parameters.';

  const allocationUsd = verdict === 'APPROVE' ? (confidence > 75 ? 1.00 : 0.80) : 0;

  return {
    verdict,
    confidence,
    disqualifiers,
    reasoning,
    allocationUsd,
  };
}

/** Evaluate narrative strength with Gemini 3.6 Flash */
export async function evaluateNarrativeWithGemini(
  symbol: string,
  description: string,
  skillContext = ''
): Promise<NarrativeScore> {
  const system =
    'You are an adversarial quantitative crypto risk analyst. ' +
    'Evaluate narrative strength and catalyst validity. Be skeptical of hype. ' +
    'Keep reasoning under 25 words. ' +
    'Return ONLY valid JSON matching this schema: {"narrative_category": string, "confidence_score": number (0-100), "reasoning": string}.' +
    (skillContext ? `\nContext: ${skillContext}` : '');

  const user =
    `Asset: ${symbol}\n` +
    `Data: ${description}\n\n` +
    `Does this asset have genuine institutional volume momentum, or is it an illiquid retail trap?\n` +
    `Return JSON: {"narrative_category":"string","confidence_score":number(0-100),"reasoning":"string"}`;

  return callGeminiWithRotation(system, user, 6000);
}

/**
 * On-demand testing of all 6 Gemini keys (invoked when user clicks "Test All Keys" in UI)
 */
export async function pingAllGeminiKeys(): Promise<
  Array<{ index: number; keyMasked: string; status: 'HEALTHY' | 'ERROR' | 'RATE_LIMITED'; latencyMs: number; error?: string }>
> {
  const results = [];
  for (let i = 0; i < CONFIG.GEMINI_KEYS.length; i++) {
    const key = CONFIG.GEMINI_KEYS[i];
    const masked = key.slice(0, 8) + '...' + key.slice(-4);
    const start = Date.now();
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
        signal: AbortSignal.timeout(4000),
      });

      const latencyMs = Date.now() - start;
      geminiKeyLatency.set(key, latencyMs);

      if (res.status === 429) {
        geminiRateLimitedKeys.set(key, Date.now() + 60000);
        geminiKeyErrors.set(key, 'Rate limited (429)');
        results.push({ index: i, keyMasked: masked, status: 'RATE_LIMITED' as const, latencyMs, error: 'HTTP 429' });
      } else if (!res.ok) {
        geminiKeyErrors.set(key, `HTTP ${res.status}`);
        results.push({ index: i, keyMasked: masked, status: 'ERROR' as const, latencyMs, error: `HTTP ${res.status}` });
      } else {
        geminiKeyErrors.delete(key);
        results.push({ index: i, keyMasked: masked, status: 'HEALTHY' as const, latencyMs });
      }
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      geminiKeyErrors.set(key, err.message);
      results.push({ index: i, keyMasked: masked, status: 'ERROR' as const, latencyMs, error: err.message });
    }
  }
  return results;
}

/** Get live telemetry across the 6 Gemini keys without triggering external calls */
export function getGeminiTelemetry() {
  const keys = CONFIG.GEMINI_KEYS.map((key, i) => {
    const isRateLimited = (geminiRateLimitedKeys.get(key) || 0) > Date.now();
    const lastError = geminiKeyErrors.get(key);
    const usage = geminiKeyUsage.get(key) || 0;
    const latency = geminiKeyLatency.get(key) || 0;

    let status: 'IN_USE' | 'HEALTHY' | 'RATE_LIMITED' | 'ERROR' | 'STANDBY' = 'HEALTHY';
    if (isRateLimited) status = 'RATE_LIMITED';
    else if (lastError) status = 'ERROR';
    else if (i === currentGeminiKeyIndex) status = 'IN_USE';

    return {
      index: i + 1,
      keyMasked: key.slice(0, 8) + '...' + key.slice(-4),
      status,
      usage,
      latencyMs: latency,
      lastError: lastError || null,
    };
  });

  return {
    provider: 'Google Gemini',
    model: CONFIG.GEMINI_MODEL,
    totalKeys: CONFIG.GEMINI_KEYS.length,
    activeKeyIndex: currentGeminiKeyIndex + 1,
    keys,
  };
}
