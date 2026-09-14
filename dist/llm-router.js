"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateNarrative = evaluateNarrative;
exports.evaluateRiskVerdict = evaluateRiskVerdict;
/**
 * llm-router.ts (v3.1)
 * Dual-Engine Cloud LLM Router:
 * Primary: Google Gemini 3.6 Flash (6-Key Rotation)
 * Secondary: Groq Cloud Array (5-Key Rotation Failover)
 * Tertiary: Strict Quantitative Deterministic Fallback
 */
const gemini_client_1 = require("./gemini-client");
const groq_client_1 = require("./groq-client");
const risk_governor_1 = require("./risk-governor");
async function evaluateNarrative(symbol, description, skillContext = '') {
    // 1. Primary: Attempt Google Gemini 3.6 Flash
    try {
        const result = await (0, gemini_client_1.evaluateNarrativeWithGemini)(symbol, description, skillContext);
        console.log(`[LLM Router] Narrative for ${symbol} via Gemini 3.6 Flash ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
        return { ...result, llmSource: 'gemini' };
    }
    catch (geminiErr) {
        console.warn(`[LLM Router] Gemini failed (${geminiErr.message}). Failing over to Groq...`);
    }
    // 2. Secondary: Failover to Groq Array
    try {
        const result = await (0, groq_client_1.evaluateNarrativeWithGroq)(symbol, description, skillContext);
        console.log(`[LLM Router] Narrative for ${symbol} via Groq Failover ✅ (${result.narrative_category}, score: ${result.confidence_score})`);
        return { ...result, llmSource: 'groq' };
    }
    catch (groqErr) {
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
async function evaluateRiskVerdict(params) {
    // 1. Primary: Attempt Google Gemini 3.6 Flash
    try {
        const result = await (0, gemini_client_1.evaluateRiskVerdictWithGemini)(params);
        const approved = result.verdict === 'APPROVE';
        risk_governor_1.riskGovernor.recordLlmDecision(approved);
        console.log(`[LLM Router v3.3 Trader] ⚡ Decision via Gemini 3.6 Flash for ${params.symbol}: ${result.decision} | Verdict: ${result.verdict} (WinProb: ${result.winProbability}%, Conf: ${result.confidence}/100)`);
        if (result.marketStructureAnalysis) {
            console.log(`[LLM Router v3.3 Trader] 📊 Gemini Market Structure: ${result.marketStructureAnalysis}`);
        }
        if (!approved && result.disqualifiers.length > 0) {
            console.log(`[LLM Router v3.3 Trader] 🛑 Gemini Veto reason: ${result.disqualifiers.join(', ')}`);
        }
        return { ...result, llmSource: 'gemini' };
    }
    catch (geminiErr) {
        console.warn(`[LLM Router] ⚠️ Gemini 3.6 Flash failed (${geminiErr.message}). Failing over to Groq Array...`);
    }
    // 2. Secondary: Failover to Groq Cloud Array
    try {
        const result = await (0, groq_client_1.evaluateRiskVerdictWithGroq)(params);
        const approved = result.verdict === 'APPROVE';
        risk_governor_1.riskGovernor.recordLlmDecision(approved);
        console.log(`[LLM Router v3.3 Trader] 🛡️ Decision via Groq Failover for ${params.symbol}: ${result.decision} | Verdict: ${result.verdict} (WinProb: ${result.winProbability}%, Conf: ${result.confidence}/100)`);
        if (!approved && result.disqualifiers.length > 0) {
            console.log(`[LLM Router v3.3 Trader] 🛑 Groq Veto reason: ${result.disqualifiers.join(', ')}`);
        }
        return { ...result, llmSource: 'groq' };
    }
    catch (groqErr) {
        console.warn(`[LLM Router] ❌ Both Gemini & Groq failed (${groqErr.message}). Using strict quantitative fallback.`);
    }
    // 3. Tertiary: Strict Quantitative Deterministic Fallback
    const t = params.technicalBlock;
    const isCleanLong = params.action === 'LONG' && t.rsi5m <= 52 && t.rsi5m >= 38 && t.volumeZ5m >= 0.8 && t.chop15m <= 58 && params.plannedRR >= 1.6;
    const isCleanShort = params.action === 'SHORT' && t.rsi5m >= 48 && t.rsi5m <= 62 && t.volumeZ5m >= 0.8 && t.chop15m <= 58 && params.plannedRR >= 1.6;
    const fallbackApproved = isCleanLong || isCleanShort;
    risk_governor_1.riskGovernor.recordLlmDecision(fallbackApproved);
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
//# sourceMappingURL=llm-router.js.map