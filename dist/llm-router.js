"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateNarrative = evaluateNarrative;
exports.evaluateRiskVerdict = evaluateRiskVerdict;
/**
 * llm-router.ts (v3.0)
 * Cloud LLM Router with Adversarial Risk Gate & Telemetry
 */
const groq_client_1 = require("./groq-client");
const risk_governor_1 = require("./risk-governor");
async function evaluateNarrative(symbol, description, skillContext = '') {
    try {
        const result = await (0, groq_client_1.evaluateNarrativeWithGroq)(symbol, description, skillContext);
        console.log(`[LLM Router] Narrative for ${symbol} via Groq ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
        return { ...result, llmSource: 'groq' };
    }
    catch (err) {
        console.warn(`[LLM Router] Groq failed: ${err.message}. Using rule-based fallback.`);
        return {
            narrative_category: 'MOMENTUM',
            confidence_score: 50,
            reasoning: `Rule-based fallback: ${err.message}`,
            llmSource: 'rule-based',
        };
    }
}
async function evaluateRiskVerdict(params) {
    try {
        const result = await (0, groq_client_1.evaluateRiskVerdictWithGroq)(params);
        const approved = result.verdict === 'APPROVE';
        risk_governor_1.riskGovernor.recordLlmDecision(approved);
        console.log(`[LLM Router v3.0 CRO] Verdict for ${params.symbol}: ${result.verdict} (Confidence: ${result.confidence}/100)`);
        if (!approved && result.disqualifiers.length > 0) {
            console.log(`[LLM Router v3.0 CRO] 🛑 Vetoed due to: ${result.disqualifiers.join(', ')}`);
        }
        return { ...result, llmSource: 'groq' };
    }
    catch (err) {
        console.warn(`[LLM Router] Groq CRO audit failed: ${err.message}. Using strict quantitative fallback.`);
        const t = params.technicalBlock;
        const isCleanLong = params.action === 'LONG' && t.rsi5m <= 50 && t.rsi5m >= 38 && t.volumeZ5m >= 1.0 && t.chop15m <= 55 && params.plannedRR >= 1.6;
        const isCleanShort = params.action === 'SHORT' && t.rsi5m >= 50 && t.rsi5m <= 62 && t.volumeZ5m >= 1.0 && t.chop15m <= 55 && params.plannedRR >= 1.6;
        const fallbackApproved = isCleanLong || isCleanShort;
        risk_governor_1.riskGovernor.recordLlmDecision(fallbackApproved);
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
//# sourceMappingURL=llm-router.js.map