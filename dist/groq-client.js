"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateNarrativeWithGroq = evaluateNarrativeWithGroq;
exports.evaluateRiskVerdictWithGroq = evaluateRiskVerdictWithGroq;
exports.getActiveGroqKeyIndex = getActiveGroqKeyIndex;
exports.getGroqUsageSummary = getGroqUsageSummary;
/**
 * groq-client.ts
 * Cloud LLM Engine — Groq API with seamless 5-key rotation and rate-limit recovery.
 */
const config_1 = require("./config");
// Key usage & rotation tracker
let currentKeyIndex = 0;
const keyUsage = new Map();
const rateLimitedKeys = new Map();
/** Get current active key with round-robin rotation & cooldown bypass */
function getNextGroqKey() {
    if (config_1.CONFIG.GROQ_KEYS.length === 0)
        throw new Error('No Groq API keys configured');
    const now = Date.now();
    // Clear keys whose rate limit cooldown (60s) has passed
    for (const [k, expiry] of rateLimitedKeys.entries()) {
        if (now > expiry)
            rateLimitedKeys.delete(k);
    }
    // Try finding a key that is not currently rate-limited
    for (let i = 0; i < config_1.CONFIG.GROQ_KEYS.length; i++) {
        const idx = (currentKeyIndex + i) % config_1.CONFIG.GROQ_KEYS.length;
        const candidate = config_1.CONFIG.GROQ_KEYS[idx];
        if (!rateLimitedKeys.has(candidate)) {
            currentKeyIndex = (idx + 1) % config_1.CONFIG.GROQ_KEYS.length;
            keyUsage.set(candidate, (keyUsage.get(candidate) || 0) + 1);
            return { key: candidate, index: idx };
        }
    }
    // If all are rate-limited, use least-recently-limited
    const fallbackKey = config_1.CONFIG.GROQ_KEYS[currentKeyIndex % config_1.CONFIG.GROQ_KEYS.length];
    currentKeyIndex = (currentKeyIndex + 1) % config_1.CONFIG.GROQ_KEYS.length;
    keyUsage.set(fallbackKey, (keyUsage.get(fallbackKey) || 0) + 1);
    return { key: fallbackKey, index: currentKeyIndex };
}
function parseJsonClean(raw) {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```json'))
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    else if (cleaned.startsWith('```'))
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    return JSON.parse(cleaned);
}
/** Execute a prompt on Groq with automatic key failover */
async function callGroqWithRotation(system, user, timeoutMs = 12000) {
    const maxAttempts = Math.min(config_1.CONFIG.GROQ_KEYS.length, 3);
    let lastError = null;
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
                    model: config_1.CONFIG.GROQ_MODEL,
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
            const json = (await res.json());
            const content = json.choices?.[0]?.message?.content;
            if (!content)
                throw new Error('Empty response from Groq');
            return parseJsonClean(content);
        }
        catch (err) {
            lastError = err;
            console.warn(`[Groq] Attempt ${attempt + 1} with key #${index + 1} failed: ${err.message}`);
        }
    }
    throw lastError || new Error('All Groq keys failed');
}
async function evaluateNarrativeWithGroq(symbol, description, skillContext = '') {
    const system = 'You are an expert quantitative crypto research analyst. ' +
        'Evaluate narrative strength and catalyst potential. ' +
        'Keep reasoning under 25 words. ' +
        'Return ONLY valid JSON matching this schema: {"narrative_category": string, "confidence_score": number (0-100), "reasoning": string}.' +
        (skillContext ? `\nContext: ${skillContext}` : '');
    const user = `Asset: ${symbol}\n` +
        `Description: ${description}\n\n` +
        `Evaluate if this token has strong momentum catalysts or narrative tailwinds.\n` +
        `Return JSON: {"narrative_category":"string","confidence_score":number(0-100),"reasoning":"string"}`;
    return callGroqWithRotation(system, user);
}
async function evaluateRiskVerdictWithGroq(params) {
    const system = 'You are an elite quantitative crypto risk manager. ' +
        'Evaluate short-term futures trade viability based on technical momentum, volume flow, and narrative alignment. ' +
        'Be decisive: favor LONG or SHORT when trend and momentum agree. Keep reasoning under 25 words. ' +
        'Return ONLY valid JSON matching this schema: {"verdict": "LONG" | "SHORT" | "VETO" | "WARN", "allocationUsd": number (0-100), "reasoning": string}.';
    const user = `Evaluate futures trade setup for: ${params.symbol}\n` +
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
function getActiveGroqKeyIndex() {
    return currentKeyIndex;
}
function getGroqUsageSummary() {
    return {
        keyUsage: Object.fromEntries(keyUsage),
        rateLimitedCount: rateLimitedKeys.size,
        totalKeys: config_1.CONFIG.GROQ_KEYS.length,
        activeKeyIndex: currentKeyIndex,
    };
}
//# sourceMappingURL=groq-client.js.map