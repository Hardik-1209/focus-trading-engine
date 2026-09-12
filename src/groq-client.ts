/**
 * groq-client.ts
 * Cloud LLM Engine — Groq API with seamless 5-key rotation and rate-limit recovery.
 */
import { CONFIG } from './config';

export interface NarrativeScore {
  narrative_category: string;
  confidence_score: number;
  reasoning: string;
}

export interface RiskVerdict {
  verdict: 'LONG' | 'SHORT' | 'VETO' | 'WARN';
  allocationUsd: number;
  reasoning: string;
}

export interface RiskParams {
  symbol: string;
  auditBlock: { isScam: boolean; scamRiskScore: number; flags: string[]; details: string };
  technicalBlock: {
    emaCrossover: boolean; latestEMA: number; latestADX: number; latestZScore: number;
    latestRSI: number; rsiOversold: boolean; rsiOverbought: boolean;
    macdBullish: boolean; macdBearish: boolean; macdCrossUp: boolean; macdCrossDown: boolean;
    latestHistogram: number;
  };
  narrativeBlock: { narrativeCategory: string; confidenceScore: number; reasoning: string };
  macroRegime: string;
  isMacroHostile: boolean;
}

// Key usage & rotation tracker
let currentKeyIndex = 0;
const keyUsage: Map<string, number> = new Map();
const rateLimitedKeys: Map<string, number> = new Map();

/** Get current active key with round-robin rotation & cooldown bypass */
function getNextGroqKey(): { key: string; index: number } {
  if (CONFIG.GROQ_KEYS.length === 0) throw new Error('No Groq API keys configured');

  const now = Date.now();
  // Clear keys whose rate limit cooldown (60s) has passed
  for (const [k, expiry] of rateLimitedKeys.entries()) {
    if (now > expiry) rateLimitedKeys.delete(k);
  }

  // Try finding a key that is not currently rate-limited
  for (let i = 0; i < CONFIG.GROQ_KEYS.length; i++) {
    const idx = (currentKeyIndex + i) % CONFIG.GROQ_KEYS.length;
    const candidate = CONFIG.GROQ_KEYS[idx];
    if (!rateLimitedKeys.has(candidate)) {
      currentKeyIndex = (idx + 1) % CONFIG.GROQ_KEYS.length;
      keyUsage.set(candidate, (keyUsage.get(candidate) || 0) + 1);
      return { key: candidate, index: idx };
    }
  }

  // If all are rate-limited, use least-recently-limited
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
          temperature: 0.1,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.status === 429) {
        console.warn(`[Groq] Key #${index + 1} rate-limited. Rotating to next key...`);
        rateLimitedKeys.set(key, Date.now() + 60000); // 60s cooldown
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
    'You are an expert quantitative crypto research analyst. ' +
    'Evaluate narrative strength and catalyst potential. ' +
    'Keep reasoning under 25 words. ' +
    'Return ONLY valid JSON matching this schema: {"narrative_category": string, "confidence_score": number (0-100), "reasoning": string}.' +
    (skillContext ? `\nContext: ${skillContext}` : '');

  const user =
    `Asset: ${symbol}\n` +
    `Description: ${description}\n\n` +
    `Evaluate if this token has strong momentum catalysts or narrative tailwinds.\n` +
    `Return JSON: {"narrative_category":"string","confidence_score":number(0-100),"reasoning":"string"}`;

  return callGroqWithRotation(system, user);
}

export async function evaluateRiskVerdictWithGroq(params: RiskParams): Promise<RiskVerdict> {
  const system =
    'You are an elite quantitative crypto risk manager. ' +
    'Evaluate short-term futures trade viability based on technical momentum, volume flow, and narrative alignment. ' +
    'Be decisive: favor LONG or SHORT when trend and momentum agree. Keep reasoning under 25 words. ' +
    'Return ONLY valid JSON matching this schema: {"verdict": "LONG" | "SHORT" | "VETO" | "WARN", "allocationUsd": number (0-100), "reasoning": string}.';

  const user =
    `Evaluate futures trade setup for: ${params.symbol}\n` +
    `Macro: ${params.macroRegime}, Hostile: ${params.isMacroHostile}\n` +
    `Security: ${JSON.stringify(params.auditBlock)}\n` +
    `Technicals: RSI=${params.technicalBlock.latestRSI.toFixed(1)}, ADX=${params.technicalBlock.latestADX.toFixed(1)}, ` +
    `Price>EMA=${params.technicalBlock.emaCrossover}, MACD_Bull=${params.technicalBlock.macdBullish}, MACD_Bear=${params.technicalBlock.macdBearish}, ` +
    `VolumeZ=${params.technicalBlock.latestZScore.toFixed(2)}\n` +
    `Narrative: ${JSON.stringify(params.narrativeBlock)}\n\n` +
    `Rules:\n` +
    `- LONG: RSI bullish (>48), Price>EMA or MACD bullish, not hostile. High probability.\n` +
    `- SHORT: RSI bearish (<52), Price<EMA or MACD bearish, not hostile. High probability.\n` +
    `- VETO: scam risk or severe macro hostile\n` +
    `- WARN: extreme conflict only\n\n` +
    `Return JSON: {"verdict":"LONG"|"SHORT"|"VETO"|"WARN","allocationUsd":number(0-100),"reasoning":"string"}`;

  return callGroqWithRotation(system, user);
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
