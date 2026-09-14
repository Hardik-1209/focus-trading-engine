/**
 * llm-router.ts (v3.1)
 * Dual-Engine Cloud LLM Router:
 * Primary: Google Gemini 3.6 Flash (6-Key Rotation)
 * Secondary: Groq Cloud Array (5-Key Rotation Failover)
 * Tertiary: Strict Quantitative Deterministic Fallback
 */
import {
  evaluateNarrativeWithGemini,
  evaluateRiskVerdictWithGemini,
  evaluateOpenPositionWithGemini,
} from './gemini-client';
import {
  evaluateNarrativeWithGroq,
  evaluateRiskVerdictWithGroq,
  evaluateOpenPositionWithGroq,
  NarrativeScore,
  RiskVerdict,
  RiskParams,
  AiPositionReview,
} from './groq-client';
import type { Candle } from './indicators';
import { riskGovernor } from './risk-governor';

export type LlmProvider = 'gemini' | 'groq' | 'rule-based';

export async function evaluateNarrative(
  symbol: string,
  description: string,
  skillContext = ''
): Promise<NarrativeScore & { llmSource: LlmProvider }> {
  // 1. Primary: Attempt Google Gemini 3.6 Flash
  try {
    const result = await evaluateNarrativeWithGemini(symbol, description, skillContext);
    console.log(`[LLM Router] Narrative for ${symbol} via Gemini 3.6 Flash ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
    return { ...result, llmSource: 'gemini' };
  } catch (geminiErr: any) {
    console.warn(`[LLM Router] Gemini failed (${geminiErr.message}). Failing over to Groq...`);
  }

  // 2. Secondary: Failover to Groq Array
  try {
    const result = await evaluateNarrativeWithGroq(symbol, description, skillContext);
    console.log(`[LLM Router] Narrative for ${symbol} via Groq Failover ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
    return { ...result, llmSource: 'groq' };
  } catch (groqErr: any) {
    console.warn(`[LLM Router] Groq also failed (${groqErr.message}). Using rule-based fallback.`);
  }

  // 3. Tertiary Fallback
  return {
    narrative_category: 'MOMENTUM',
    confidence_score: 50,
    reasoning: 'Rule-based fallback due to LLM timeout',
    llmSource: 'rule-based',
  };
}

export async function evaluateRiskVerdict(
  params: RiskParams
): Promise<RiskVerdict & { llmSource: LlmProvider }> {
  // 1. Primary: Attempt Google Gemini 3.6 Flash
  try {
    const result = await evaluateRiskVerdictWithGemini(params);
    const approved = result.verdict === 'APPROVE';
    riskGovernor.recordLlmDecision(approved);

    console.log(`[LLM Router v3.3 Trader] ⚡ Decision via Gemini 3.6 Flash for ${params.symbol}: ${result.decision} | Verdict: ${result.verdict} (WinProb: ${result.winProbability}%, Conf: ${result.confidence}/100)`);
    if (result.marketStructureAnalysis) {
      console.log(`[LLM Router v3.3 Trader] 📊 Gemini Market Structure: ${result.marketStructureAnalysis}`);
    }
    if (!approved && result.disqualifiers.length > 0) {
      console.log(`[LLM Router v3.3 Trader] 🛑 Gemini Veto reason: ${result.disqualifiers.join(', ')}`);
    }

    return { ...result, llmSource: 'gemini' };
  } catch (geminiErr: any) {
    console.warn(`[LLM Router] ⚠️ Gemini 3.6 Flash failed (${geminiErr.message}). Failing over to Groq Array...`);
  }

  // 2. Secondary: Failover to Groq Cloud Array
  try {
    const result = await evaluateRiskVerdictWithGroq(params);
    const approved = result.verdict === 'APPROVE';
    riskGovernor.recordLlmDecision(approved);

    console.log(`[LLM Router v3.3 Trader] 🛡️ Decision via Groq Failover for ${params.symbol}: ${result.decision} | Verdict: ${result.verdict} (WinProb: ${result.winProbability}%, Conf: ${result.confidence}/100)`);
    if (!approved && result.disqualifiers.length > 0) {
      console.log(`[LLM Router v3.3 Trader] 🛑 Groq Veto reason: ${result.disqualifiers.join(', ')}`);
    }

    return { ...result, llmSource: 'groq' };
  } catch (groqErr: any) {
    console.warn(`[LLM Router] ❌ Both Gemini & Groq failed (${groqErr.message}). Using strict quantitative fallback.`);
  }

  // 3. Tertiary: Strict Quantitative Deterministic Fallback
  const t = params.technicalBlock;
  const isCleanLong = params.action === 'LONG' && t.rsi5m <= 52 && t.rsi5m >= 38 && t.volumeZ5m >= 0.8 && t.chop15m <= 58 && params.plannedRR >= 1.6;
  const isCleanShort = params.action === 'SHORT' && t.rsi5m >= 48 && t.rsi5m <= 62 && t.volumeZ5m >= 0.8 && t.chop15m <= 58 && params.plannedRR >= 1.6;
  const fallbackApproved = isCleanLong || isCleanShort;
  riskGovernor.recordLlmDecision(fallbackApproved);

  return {
    verdict: fallbackApproved ? 'APPROVE' : 'VETO',
    decision: fallbackApproved ? (params.action === 'LONG' ? 'EXECUTE_LONG' : 'EXECUTE_SHORT') : 'STAND_ASIDE',
    confidence: fallbackApproved ? 75 : 30,
    winProbability: fallbackApproved ? 65 : 35,
    disqualifiers: fallbackApproved ? [] : ['RULE_FALLBACK_FAILED'],
    allocationUsd: fallbackApproved ? 1.00 : 0,
    reasoning: `Quantitative rule fallback: ${fallbackApproved ? 'Passed strict MTF parameters' : 'Failed MTF parameters'}`,
    llmSource: 'rule-based',
  };
}

/**
 * Dual-Engine AI Open Position Review
 * Primary: Google Gemini 3.6 Flash
 * Secondary Failover: Groq Cloud
 */
export async function evaluateOpenPosition(
  pos: {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    openedAt: number;
  },
  currentPrice: number,
  candles5m: Candle[],
  candles15m: Candle[]
): Promise<AiPositionReview & { llmSource: LlmProvider }> {
  // 1. Primary: Google Gemini 3.6 Flash
  try {
    const res = await evaluateOpenPositionWithGemini(pos, currentPrice, candles5m, candles15m);
    return { ...res, llmSource: 'gemini' };
  } catch (err: any) {
    console.warn(`[LLM Router] Gemini Position Review failed for ${pos.symbol} (${err.message}). Failing over to Groq...`);
  }

  // 2. Secondary: Groq Cloud
  try {
    const res = await evaluateOpenPositionWithGroq(pos, currentPrice, candles5m, candles15m);
    return { ...res, llmSource: 'groq' };
  } catch (err: any) {
    console.warn(`[LLM Router] Groq Position Review failed for ${pos.symbol} (${err.message}). Falling back to HOLD.`);
  }

  return {
    action: 'HOLD',
    reason: 'Failover default: Maintaining position until tick trigger',
    llmSource: 'rule-based',
  };
}

export type { NarrativeScore, RiskVerdict, RiskParams, AiPositionReview };
