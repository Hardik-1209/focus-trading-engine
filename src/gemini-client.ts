/**
 * gemini-client.ts (v3.1)
 * Primary Cloud LLM Engine — Google Gemini 3.6 Flash
 * 6-Key Round-Robin Rotation Array with 60s Rate-Limit Cooldown & Passive Telemetry.
 */
import { CONFIG } from './config';
import type { Candle } from './indicators';
import type { RiskParams, RiskVerdict, NarrativeScore, AutonomousDecision } from './groq-client';

function fmtPrice(val: number): string {
  if (val >= 1000) return val.toFixed(2);
  if (val >= 1) return val.toFixed(4);
  if (val >= 0.01) return val.toFixed(6);
  return val.toFixed(8);
}

/**
 * Serializes raw Candle array into a structured tabular representation for LLM analysis.
 * Chronological order: oldest candle is row 1, newest candle is at bottom marked (CURRENT).
 */
export function formatCandleSequence(candles: Candle[] = [], timeframe: string, maxCount = 16): string {
  if (!candles || candles.length === 0) return `[No ${timeframe} candle data available]`;

  const slice = candles.slice(-maxCount);
  const rows: string[] = [];
  rows.push(`Timeframe: ${timeframe} (Last ${slice.length} candles, chronological: oldest -> newest):`);
  rows.push(`Index | Time (UTC) | Open | High | Low | Close | Volume | Change%`);

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    const isLatest = i === slice.length - 1;
    const date = new Date(c.timestamp);
    const timeStr = date.toISOString().substring(11, 16);
    const chgPct = c.open > 0 ? (((c.close - c.open) / c.open) * 100).toFixed(2) : '0.00';
    const sign = Number(chgPct) >= 0 ? '+' : '';
    const label = isLatest ? `${i + 1} (CURRENT)` : `${i + 1}`;
    rows.push(
      `${label.padEnd(11)} | ${timeStr} | ${fmtPrice(c.open)} | ${fmtPrice(c.high)} | ${fmtPrice(c.low)} | ${fmtPrice(c.close)} | ${Math.round(c.volume).toLocaleString()} | ${sign}${chgPct}%`
    );
  }

  return rows.join('\n');
}

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
async function callGeminiWithRotation(system: string, userPrompt: string, timeoutMs = 12000): Promise<any> {
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
            maxOutputTokens: 2500,
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
 * v3.3 Autonomous Senior Quantitative Trader — Gemini 3.6 Flash
 * Empowered with capital ownership ($10 wallet), raw 15m/5m candle sequences,
 * and autonomous decision authority (direction, win probability, dynamic structural SL/TP).
 */
export async function evaluateRiskVerdictWithGemini(params: RiskParams): Promise<RiskVerdict> {
  const system =
    'You are the Principal Quantitative Trader at a high-performance proprietary crypto fund. ' +
    'You are trading YOUR OWN personal capital ($10.00 total wallet balance).\n\n' +
    'CRITICAL CAPITAL REALITY:\n' +
    '- Every single dollar in this wallet belongs to you. Every cent lost to bad trades or loose stops is PERMANENTLY GONE. There are no bailouts.\n' +
    '- If your balance suffers drawdown, you will be ruined and shut down. Survival demands ironclad risk discipline.\n' +
    '- You NEVER gamble into choppy noise, liquidity traps, or late FOMO momentum.\n' +
    '- You ONLY risk capital when the raw market structure gives you a verified statistical edge (Win Probability >= 60%) with Reward:Risk >= 1.5:1.\n\n' +
    'DATA HIERARCHY & SOURCE OF TRUTH:\n' +
    '1. RAW CANDLESTICK DATA (15m & 5m OHLCV):\n' +
    '   This is your PRIMARY SOURCE OF TRUTH. You must compute market structure, trend continuity, support/resistance levels, rejection wicks, and volume absorption from these raw candles yourself.\n' +
    '2. ADVISORY SIGNALS (SECONDARY HEURISTICS):\n' +
    '   Any indicator figures (RSI, VWAP, ADX, regime) provided in the prompt were computed by a simplistic local bot. THEY CAN BE WRONG, LAGGING, OR MISLEADING. Treat them strictly as advisory recommendations. NEVER trust them blindly over what the raw price action shows.\n\n' +
    'YOUR AUTONOMOUS DECISION PROCESS:\n' +
    '1. 15m Structure: Identify higher highs/lows vs lower highs/lows, macro trend, and key inflection levels.\n' +
    '2. 5m Trigger: Inspect the last 3-5 candles. Look for rejection wicks, absorption, or clean pullbacks to support/VWAP. Avoid entering if price is exhausted or chasing far from value.\n' +
    '3. Win Probability (0-100%): Honestly judge if this trade will actually be profitable before invalidation. If < 60%, STAND ASIDE.\n' +
    '4. Structural Geometry: If executing, determine the exact structural invalidation level (stopLossPrice) just beyond the key swing/wick, and your realistic target (takeProfitPrice) at the next liquidity pool. Ensure Planned R:R >= 1.5:1.\n' +
    '5. Final Decision: Output EXECUTE_LONG, EXECUTE_SHORT, or STAND_ASIDE.\n\n' +
    'Return ONLY valid JSON matching this schema:\n' +
    '{\n' +
    '  "decision": "EXECUTE_LONG" | "EXECUTE_SHORT" | "STAND_ASIDE",\n' +
    '  "confidence": number (0-100),\n' +
    '  "winProbability": number (0-100),\n' +
    '  "marketStructureAnalysis": "Concise 1-2 sentence breakdown of raw 15m & 5m price action",\n' +
    '  "reasoning": "Why this trade will be profitable or why standing aside protects your capital",\n' +
    '  "stopLossPrice": number,\n' +
    '  "takeProfitPrice": number,\n' +
    '  "plannedRR": number,\n' +
    '  "disqualifiers": string[]\n' +
    '}';

  const currentPrice = params.technicalBlock.currentPrice;
  const fundingStr = params.fundingRate !== undefined ? (params.fundingRate * 100).toFixed(4) + '%' : 'Neutral';

  const user =
    `=== YOUR CAPITAL STATUS ===\n` +
    `Wallet Balance: $10.00 (YOUR REAL MONEY - PROTECT EVERY CENT)\n` +
    `Position Sizing: $1.00 margin @ 3x leverage ($3.00 notional)\n` +
    `Asset: ${params.symbol}\n` +
    `Current Price: $${fmtPrice(currentPrice)}\n` +
    `8h Funding Rate: ${fundingStr}\n\n` +
    `=== RAW MARKET DATA (PRIMARY SOURCE OF TRUTH) ===\n` +
    `${formatCandleSequence(params.candles15m || [], '15-Minute Macro Structure', 16)}\n\n` +
    `${formatCandleSequence(params.candles5m || [], '5-Minute Trigger & Execution', 12)}\n\n` +
    `=== ADVISORY RECOMMENDATIONS (LOCAL HEURISTICS - DO NOT TRUST BLINDLY) ===\n` +
    `- Local Bot Suggested Direction: ${params.action}\n` +
    `- Local Planned Stop Loss: $${fmtPrice(params.stopLossPrice)} | Take Profit: $${fmtPrice(params.takeProfitPrice)}\n` +
    `- Local Planned R:R: ${params.plannedRR.toFixed(2)}:1\n` +
    `- Local Advisory Indicators: 15m Regime: ${params.technicalBlock.regime15m} | ADX: ${params.technicalBlock.adx15m.toFixed(1)} | CHOP: ${params.technicalBlock.chop15m.toFixed(1)} | 5m RSI: ${params.technicalBlock.rsi5m.toFixed(1)} | VWAP: $${fmtPrice(params.technicalBlock.vwap5m)} | Vol Z-Score: ${params.technicalBlock.volumeZ5m.toFixed(2)} | ATR: $${fmtPrice(params.technicalBlock.atr5m)}\n\n` +
    `=== YOUR TRADING DECISION ===\n` +
    `Analyze the raw candles above. Is this trade truly going to be profitable?\n` +
    `Are you willing to risk your own capital on it?\n` +
    `Define your decision, structural stopLossPrice, takeProfitPrice, and estimated winProbability. Return JSON.`;

  const parsed = await callGeminiWithRotation(system, user, 12000);

  const decision = (parsed.decision || (parsed.verdict === 'APPROVE' ? (params.action === 'LONG' ? 'EXECUTE_LONG' : 'EXECUTE_SHORT') : 'STAND_ASIDE')) as AutonomousDecision;
  const winProbability = typeof parsed.winProbability === 'number' ? parsed.winProbability : (parsed.verdict === 'APPROVE' ? 65 : 40);
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 50;
  const disqualifiers = Array.isArray(parsed.disqualifiers) ? parsed.disqualifiers : [];
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'Autonomous market analysis completed.';
  const marketStructureAnalysis = typeof parsed.marketStructureAnalysis === 'string' ? parsed.marketStructureAnalysis : '';

  // Capital ownership filter: Only approve trades where the Autonomous Trader decides to execute AND win probability >= 60%
  const isApproved = (decision === 'EXECUTE_LONG' || decision === 'EXECUTE_SHORT') && winProbability >= 60;
  const verdict = isApproved ? 'APPROVE' : 'VETO';

  return {
    verdict,
    decision,
    confidence,
    winProbability,
    disqualifiers,
    reasoning,
    marketStructureAnalysis,
    suggestedStopLoss: typeof parsed.stopLossPrice === 'number' && parsed.stopLossPrice > 0 ? parsed.stopLossPrice : undefined,
    suggestedTakeProfit: typeof parsed.takeProfitPrice === 'number' && parsed.takeProfitPrice > 0 ? parsed.takeProfitPrice : undefined,
    allocationUsd: isApproved ? 1.00 : 0,
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
