import { NarrativeScore, RiskVerdict, RiskParams, AiPositionReview } from './groq-client';
import type { Candle } from './indicators';
export type LlmProvider = 'gemini' | 'groq' | 'rule-based';
export declare function evaluateNarrative(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore & {
    llmSource: LlmProvider;
}>;
export declare function evaluateRiskVerdict(params: RiskParams): Promise<RiskVerdict & {
    llmSource: LlmProvider;
}>;
/**
 * Dual-Engine AI Open Position Review
 * Primary: Google Gemini 3.6 Flash
 * Secondary Failover: Groq Cloud
 */
export declare function evaluateOpenPosition(pos: {
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    entryPrice: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    openedAt: number;
}, currentPrice: number, candles5m: Candle[], candles15m: Candle[]): Promise<AiPositionReview & {
    llmSource: LlmProvider;
}>;
export type { NarrativeScore, RiskVerdict, RiskParams, AiPositionReview };
//# sourceMappingURL=llm-router.d.ts.map