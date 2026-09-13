/**
 * llm-router.ts (v3.0)
 * Cloud LLM Router with Adversarial Risk Gate & Telemetry
 */
import {
  evaluateNarrativeWithGroq,
  evaluateRiskVerdictWithGroq,
  NarrativeScore,
  RiskVerdict,
  RiskParams,
} from './groq-client';
import { riskGovernor } from './risk-governor';

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
      confidence_score: 50,
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
    const approved = result.verdict === 'APPROVE';
    riskGovernor.recordLlmDecision(approved);

    console.log(`[LLM Router v3.0 CRO] Verdict for ${params.symbol}: ${result.verdict} (Confidence: ${result.confidence}/100)`);
    if (!approved && result.disqualifiers.length > 0) {
      console.log(`[LLM Router v3.0 CRO] 🛑 Vetoed due to: ${result.disqualifiers.join(', ')}`);
    }

    return { ...result, llmSource: 'groq' };
  } catch (err: any) {
    console.warn(`[LLM Router] Groq CRO audit failed: ${err.message}. Using strict quantitative fallback.`);
    const t = params.technicalBlock;
    const isCleanLong = params.action === 'LONG' && t.rsi5m <= 50 && t.rsi5m >= 38 && t.volumeZ5m >= 1.0 && t.chop15m <= 55 && params.plannedRR >= 1.6;
    const isCleanShort = params.action === 'SHORT' && t.rsi5m >= 50 && t.rsi5m <= 62 && t.volumeZ5m >= 1.0 && t.chop15m <= 55 && params.plannedRR >= 1.6;
    const fallbackApproved = isCleanLong || isCleanShort;
    riskGovernor.recordLlmDecision(fallbackApproved);

    return {
      verdict: fallbackApproved ? 'APPROVE' : 'VETO',
      confidence: fallbackApproved ? 75 : 30,
      disqualifiers: fallbackApproved ? [] : ['RULE_FALLBACK_FAILED'],
      allocationUsd: fallbackApproved ? 100 : 0,
      reasoning: `Quantitative fallback: ${fallbackApproved ? 'Passed strict MTF parameters' : 'Failed strict parameters'}`,
      llmSource: 'rule-based',
    };
  }
}

export type { NarrativeScore, RiskVerdict, RiskParams };
