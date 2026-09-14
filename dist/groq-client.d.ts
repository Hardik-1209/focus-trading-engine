import type { Candle } from './indicators';
export interface NarrativeScore {
    narrative_category: string;
    confidence_score: number;
    reasoning: string;
}
export type AutonomousDecision = 'EXECUTE_LONG' | 'EXECUTE_SHORT' | 'STAND_ASIDE';
export interface RiskVerdict {
    verdict: 'APPROVE' | 'VETO';
    decision: AutonomousDecision;
    confidence: number;
    winProbability: number;
    reasoning: string;
    marketStructureAnalysis?: string;
    suggestedStopLoss?: number;
    suggestedTakeProfit?: number;
    allocationUsd: number;
    disqualifiers: string[];
}
export interface RiskParams {
    symbol: string;
    action: 'LONG' | 'SHORT';
    plannedRR: number;
    stopLossPrice: number;
    takeProfitPrice: number;
    fundingRate?: number;
    candles15m?: Candle[];
    candles5m?: Candle[];
    walletBalance?: number;
    technicalBlock: {
        rsi5m: number;
        atr5m: number;
        volumeZ5m: number;
        vwap5m: number;
        regime15m: string;
        adx15m: number;
        chop15m: number;
        currentPrice: number;
        swingLow?: number;
        swingHigh?: number;
    };
}
export declare function evaluateNarrativeWithGroq(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore>;
/**
 * v3.0 Adversarial Chief Risk Officer (CRO) Gatekeeper
 * Evaluates setup against strict 5-point disqualification criteria.
 * Target approval rate: 20% - 35%.
 */
export declare function evaluateRiskVerdictWithGroq(params: RiskParams): Promise<RiskVerdict>;
export declare function getActiveGroqKeyIndex(): number;
export declare function getGroqUsageSummary(): {
    keyUsage: {
        [k: string]: number;
    };
    rateLimitedCount: number;
    totalKeys: number;
    activeKeyIndex: number;
};
//# sourceMappingURL=groq-client.d.ts.map