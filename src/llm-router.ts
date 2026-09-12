/**
 * llm-router.ts
 * Cloud LLM Router — High-speed reasoning via Groq with smart key rotation.
 */
import {
  evaluateNarrativeWithGroq,
  evaluateRiskVerdictWithGroq,
  NarrativeScore,
  RiskVerdict,
  RiskParams,
} from './groq-client';

export async function evaluateNarrative(
  symbol: string,
  description: string,
  skillContext = ''
): Promise<NarrativeScore & { llmSource: 'groq' | 'rule-based' }> {
  try {
    const result = await evaluateNarrativeWithGroq(symbol, description, skillContext);
    console.log(`[LLM Router] Narrative for ${symbol} via Groq ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
    return { ...result, llmSource: 'groq' };
  } catch (err: any) {
    console.warn(`[LLM Router] Groq failed: ${err.message}. Using rule-based fallback.`);
    return {
      narrative_category: 'MOMENTUM',
      confidence_score: 55,
      reasoning: `Rule-based fallback: ${err.message}`,
      llmSource: 'rule-based',
    };
  }
}

export async function evaluateRiskVerdict(
  params: RiskParams
): Promise<RiskVerdict & { llmSource: 'groq' | 'rule-based' }> {
  try {
    const result = await evaluateRiskVerdictWithGroq(params);
    console.log(`[LLM Router] Risk verdict for ${params.symbol} via Groq ✅ (${result.verdict})`);
    return { ...result, llmSource: 'groq' };
  } catch (err: any) {
    console.warn(`[LLM Router] Groq verdict failed: ${err.message}. Using quantitative rule fallback.`);
    const t = params.technicalBlock;
    const isBullish = t.emaCrossover && t.latestADX > 25 && !t.rsiOverbought && (t.macdBullish || t.macdCrossUp);
    const isBearish = !t.emaCrossover && t.latestADX > 25 && !t.rsiOversold && (t.macdBearish || t.macdCrossDown);

    return {
      verdict: params.auditBlock.isScam ? 'VETO' : isBullish ? 'LONG' : isBearish ? 'SHORT' : 'WARN',
      allocationUsd: params.auditBlock.isScam ? 0 : isBullish || isBearish ? 100 : 50,
      reasoning: `Rule-based: RSI=${t.latestRSI.toFixed(1)}, ADX=${t.latestADX.toFixed(1)}, MACD=${t.macdBullish ? 'BULL' : t.macdBearish ? 'BEAR' : 'FLAT'}`,
      llmSource: 'rule-based',
    };
  }
}

export type { NarrativeScore, RiskVerdict, RiskParams };
