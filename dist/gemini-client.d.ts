import type { Candle } from './indicators';
import type { RiskParams, RiskVerdict, NarrativeScore, AiPositionReview } from './groq-client';
/**
 * Serializes raw Candle array into a structured tabular representation for LLM analysis.
 * Chronological order: oldest candle is row 1, newest candle is at bottom marked (CURRENT).
 */
export declare function formatCandleSequence(candles: Candle[] | undefined, timeframe: string, maxCount?: number): string;
/** Get current active Gemini key with round-robin rotation & cooldown bypass */
export declare function getNextGeminiKey(): {
    key: string;
    index: number;
};
/**
 * v3.3 Autonomous Senior Quantitative Trader — Gemini 3.6 Flash
 * Empowered with capital ownership ($10 wallet), raw 15m/5m candle sequences,
 * and autonomous decision authority (direction, win probability, dynamic structural SL/TP).
 */
export declare function evaluateRiskVerdictWithGemini(params: RiskParams): Promise<RiskVerdict>;
/**
 * v3.4 Active AI Position Guardian — Gemini 3.6 Flash
 * Periodically reviews open positions against recent 5m/15m candles
 * and executes early exits when market structure breaks down.
 */
export declare function evaluateOpenPositionWithGemini(pos: {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    openedAt: number;
}, currentPrice: number, candles5m: Candle[], candles15m: Candle[]): Promise<AiPositionReview>;
/** Evaluate narrative strength with Gemini 3.6 Flash */
export declare function evaluateNarrativeWithGemini(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore>;
/**
 * On-demand testing of all 6 Gemini keys (invoked when user clicks "Test All Keys" in UI)
 */
export declare function pingAllGeminiKeys(): Promise<Array<{
    index: number;
    keyMasked: string;
    status: 'HEALTHY' | 'ERROR' | 'RATE_LIMITED';
    latencyMs: number;
    error?: string;
}>>;
/** Get live telemetry across the 6 Gemini keys without triggering external calls */
export declare function getGeminiTelemetry(): {
    provider: string;
    model: string;
    totalKeys: number;
    activeKeyIndex: number;
    keys: {
        index: number;
        keyMasked: string;
        status: "HEALTHY" | "ERROR" | "RATE_LIMITED" | "IN_USE";
        usage: number;
        latencyMs: number;
        lastError: string | null;
    }[];
};
//# sourceMappingURL=gemini-client.d.ts.map