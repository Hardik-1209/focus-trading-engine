"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOllamaReady = isOllamaReady;
exports.resetOllamaCache = resetOllamaCache;
exports.evaluateNarrativeWithOllama = evaluateNarrativeWithOllama;
exports.evaluateRiskVerdictWithOllama = evaluateRiskVerdictWithOllama;
/**
 * ollama-client.ts
 * Local LLM via Phi-4 Mini (Ollama). OpenAI-compatible API.
 * Falls back gracefully — caller handles fallback to Groq.
 */
const config_1 = require("./config");
let ollamaAvailable = null;
/** Check if Ollama is running and the model is loaded */
async function isOllamaReady() {
    if (ollamaAvailable !== null)
        return ollamaAvailable;
    try {
        const res = await fetch(`${config_1.CONFIG.OLLAMA_BASE_URL}/api/tags`, {
            signal: AbortSignal.timeout(3000)
        });
        if (!res.ok) {
            ollamaAvailable = false;
            return false;
        }
        const json = await res.json();
        const models = (json.models || []).map((m) => m.name);
        ollamaAvailable = models.some(m => m.startsWith(config_1.CONFIG.OLLAMA_MODEL.split(':')[0]));
        if (!ollamaAvailable) {
            console.warn(`[Ollama] Model "${config_1.CONFIG.OLLAMA_MODEL}" not found. Available: ${models.join(', ')}`);
        }
        else {
            console.log(`[Ollama] ✅ Ready — using ${config_1.CONFIG.OLLAMA_MODEL}`);
        }
        return ollamaAvailable;
    }
    catch {
        ollamaAvailable = false;
        return false;
    }
}
/** Reset the availability cache (called after Ollama reconnect) */
function resetOllamaCache() { ollamaAvailable = null; }
async function callOllama(systemPrompt, userPrompt, timeoutMs = 60000) {
    const res = await fetch(`${config_1.CONFIG.OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config_1.CONFIG.OLLAMA_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 512,
            stream: false,
        }),
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${err}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content)
        throw new Error('Ollama returned empty response');
    return JSON.parse(content);
}
async function evaluateNarrativeWithOllama(symbol, description, skillContext = '') {
    const system = 'You are a quantitative crypto research analyst. ' +
        'Return ONLY strict JSON matching the exact schema — no other text.' +
        (skillContext ? `\n\nTrading context:\n${skillContext}` : '');
    const prompt = `Analyze narrative potential for token: ${symbol}\n` +
        `Description: ${description}\n\n` +
        `Return JSON:\n{"narrative_category":"string","confidence_score":number(0-100),"reasoning":"string"}`;
    return await callOllama(system, prompt);
}
async function evaluateRiskVerdictWithOllama(params) {
    const system = 'You are an elite quantitative crypto risk supervisor. ' +
        'Return ONLY strict JSON — no conversational text.';
    const prompt = `Evaluate futures trading opportunity: ${params.symbol}\n\n` +
        `MACRO: Regime=${params.macroRegime}, Hostile=${params.isMacroHostile}\n\n` +
        `SECURITY: ${JSON.stringify(params.auditBlock)}\n\n` +
        `TECHNICALS:\n` +
        `  EMA14=${params.technicalBlock.latestEMA.toFixed(6)}, Price>EMA=${params.technicalBlock.emaCrossover}\n` +
        `  ADX=${params.technicalBlock.latestADX.toFixed(2)}, RSI=${params.technicalBlock.latestRSI.toFixed(1)}\n` +
        `  RSI_Oversold=${params.technicalBlock.rsiOversold}, RSI_Overbought=${params.technicalBlock.rsiOverbought}\n` +
        `  MACD_Bull=${params.technicalBlock.macdBullish}, MACD_Bear=${params.technicalBlock.macdBearish}\n` +
        `  VolumeZ=${params.technicalBlock.latestZScore.toFixed(2)}\n\n` +
        `NARRATIVE: ${JSON.stringify(params.narrativeBlock)}\n\n` +
        `RULES:\n` +
        `1. LONG → narrativeConfidence>60, price>EMA, ADX>25, NOT hostile\n` +
        `2. SHORT → narrativeConfidence<40, price<EMA, ADX>25\n` +
        `3. VETO → isScam=true OR extremely hostile macro\n` +
        `4. WARN → ADX≤25 or conflicting signals\n\n` +
        `Return JSON: {"verdict":"LONG"|"SHORT"|"VETO"|"WARN","allocationUsd":number(0-100),"reasoning":"one sentence"}`;
    return await callOllama(system, prompt);
}
//# sourceMappingURL=ollama-client.js.map