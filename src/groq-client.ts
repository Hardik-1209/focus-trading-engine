/**
 * groq-client.ts (v3.0)
 * Cloud LLM Engine — Adversarial Quantitative Chief Risk Officer
 * Seamless multi-key rotation across Groq array with rate-limit failover.
 */
import { CONFIG } from './config';

export interface NarrativeScore {
  narrative_category: string;
  confidence_score: number;
  reasoning: string;
}

export interface RiskVerdict {
  verdict: 'APPROVE' | 'VETO';
  confidence: number;
  disqualifiers: string[];
  reasoning: string;
  allocationUsd: number;
}

export interface RiskParams {
  symbol: string;
  action: 'LONG' | 'SHORT';
  plannedRR: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  fundingRate?: number;
  technicalBlock: {
    rsi5m: number;
    atr5m: number;
    volumeZ5m: number;
    vwap5m: number;
    regime15m: string;
    adx15m: number;
    chop15m: number;
    currentPrice: number;
  };
}

// Key usage & rotation tracker
let currentKeyIndex = 0;
const keyUsage: Map<string, number> = new Map();
const rateLimitedKeys: Map<string, number> = new Map();

/** Get current active key with round-robin rotation & cooldown bypass */
function getNextGroqKey(): { key: string; index: number } {
  if (CONFIG.GROQ_KEYS.length === 0) throw new Error('No Groq API keys configured');

  const now = Date.now();
  for (const [k, expiry] of rateLimitedKeys.entries()) {
    if (now > expiry) rateLimitedKeys.delete(k);
  }

  for (let i = 0; i < CONFIG.GROQ_KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % CONFIG.GROQ_KEYS.length;
    const candidate = CONFIG.GROQ_KEYS[idx];
    if (!rateLimitedKeys.has(candidate)) {
      currentKeyIndex = (idx + 1) % CONFIG.GROQ_KEYS.length;
      keyUsage.set(candidate, (keyUsage.get(candidate) || 0) + 1);
      return { key: candidate, index: idx };
    }
  }

  const fallbackKey = CONFIG.GROQ_KEYS[currentKeyIndex % CONFIG.GROQ_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % CONFIG.GROQ_KEYS.length;
  keyUsage.set(fallbackKey, (keyUsage.get(fallbackKey) || 0) + 1);
  return { key: fallbackKey, index: currentKeyIndex };
}

function parseJsonClean(raw: string): any {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  return JSON.parse(cleaned);
}

/** Execute a prompt on Groq with automatic key failover */
async function callGroqWithRotation(system: string, user: string, timeoutMs = 12000): Promise<any> {
  const maxAttempts = Math.min(CONFIG.GROQ_KEYS.length, 3);
  let lastError: any = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { key, index } = getNextGroqKey();
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: CONFIG.GROQ_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.05,
          max_tokens: 600,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        console.warn(`[Groq] Key #${index + 1} rate-limited. Rotating to next key...`);
        rateLimitedKeys.set(key, Date.now() + 60000);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Groq HTTP ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');
      return parseJsonClean(content);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Groq] Attempt ${attempt + 1} with key #${index + 1} failed: ${err.message}`);
    }
  }

  throw lastError || new Error('All Groq keys failed');
}

export async function evaluateNarrativeWithGroq(
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

  return callGroqWithRotation(system, user);
}

/**
 * v3.0 Adversarial Chief Risk Officer (CRO) Gatekeeper
 * Evaluates setup against strict 5-point disqualification criteria.
 * Target approval rate: 20% - 35%.
 */
export async function evaluateRiskVerdictWithGroq(params: RiskParams): Promise<RiskVerdict> {
  const system =
    'You are the Chief Risk Officer (CRO) at a quantitative crypto hedge fund. ' +
    'Your mission is to balance strict capital preservation with capturing high-probability intraday trading opportunities. ' +
    'Audit candidate trades across 15m/5m timeframe confluence, price action, and reward-to-risk geometry. ' +
    'VETO if any of the following severe flaws are present:\n' +
    '1. EXHAUSTION / EXTENDED ENTRY: For LONG: 5m RSI > 72 or price chasing far above VWAP without pullback. For SHORT: 5m RSI < 28 or price chasing far below VWAP.\n' +
    '2. ASYMMETRY DEFICIT: Planned Reward:Risk ratio is below 1.3:1.\n' +
    '3. SQUEEZE RISK: Extreme one-sided funding rate (> +0.05% for longs or < -0.05% for shorts indicates squeeze danger).\n' +
    '4. TOTAL DEAD AIR: Extreme chaotic chop with zero liquidity or momentum.\n\n' +
    'APPROVE if the trade represents a clean trend pullback, range-bound mean-reversion at support/resistance, or momentum breakout with R:R >= 1.3:1.\n' +
    'Return ONLY valid JSON: {\n' +
    '  "verdict": "APPROVE" | "VETO",\n' +
    '  "confidence": number (0-100),\n' +
    '  "disqualifiers": string[],\n' +
    '  "reasoning": string\n' +
    '}';

  const t = params.technicalBlock;
  const user =
    `AUDIT CANDIDATE SETUP:\n` +
    `Symbol: ${params.symbol} | Proposed Action: ${params.action}\n` +
    `Current Price: $${t.currentPrice} | SL: $${params.stopLossPrice} | TP: $${params.takeProfitPrice}\n` +
    `Planned Reward:Risk: ${params.plannedRR}:1\n` +
    `Funding Rate: ${params.fundingRate !== undefined ? (params.fundingRate * 100).toFixed(4) + '%' : 'Neutral'}\n` +
    `15m Regime: ${t.regime15m} | 15m ADX: ${t.adx15m} | 15m CHOP: ${t.chop15m}\n` +
    `5m RSI: ${t.rsi5m} | 5m ATR: $${t.atr5m} | 5m Volume Z-Score: ${t.volumeZ5m}\n\n` +
    `Audit against all 5 disqualifiers. If ANY apply, return VETO.\n` +
    `Return JSON: {"verdict":"APPROVE"|"VETO","confidence":number,"disqualifiers":["string"],"reasoning":"string"}`;

  const res = await callGroqWithRotation(system, user);

  return {
    verdict: res.verdict === 'APPROVE' ? 'APPROVE' : 'VETO',
    confidence: typeof res.confidence === 'number' ? res.confidence : 50,
    disqualifiers: Array.isArray(res.disqualifiers) ? res.disqualifiers : [],
    reasoning: res.reasoning || (res.verdict === 'APPROVE' ? 'Approved high-conviction confluence' : 'Disqualified by risk audit'),
    allocationUsd: res.verdict === 'APPROVE' ? 100 : 0,
  };
}

export function getActiveGroqKeyIndex(): number {
  return currentKeyIndex;
}

export function getGroqUsageSummary() {
  return {
    keyUsage: Object.fromEntries(keyUsage),
    rateLimitedCount: rateLimitedKeys.size,
    totalKeys: CONFIG.GROQ_KEYS.length,
    activeKeyIndex: currentKeyIndex,
  };
}
