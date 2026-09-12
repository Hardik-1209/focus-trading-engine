export interface NarrativeScore {
    narrative_category: string;
    confidence_score: number;
    reasoning: string;
}
export interface RiskVerdict {
    verdict: 'LONG' | 'SHORT' | 'VETO' | 'WARN';
    allocationUsd: number;
    reasoning: string;
}
export interface RiskParams {
    symbol: string;
    auditBlock: {
        isScam: boolean;
        scamRiskScore: number;
        flags: string[];
        details: string;
    };
    technicalBlock: {
        emaCrossover: boolean;
        latestEMA: number;
        latestADX: number;
        latestZScore: number;
        latestRSI: number;
        rsiOversold: boolean;
        rsiOverbought: boolean;
        macdBullish: boolean;
        macdBearish: boolean;
        macdCrossUp: boolean;
        macdCrossDown: boolean;
        latestHistogram: number;
    };
    narrativeBlock: {
        narrativeCategory: string;
        confidenceScore: number;
        reasoning: string;
    };
    macroRegime: string;
    isMacroHostile: boolean;
}
export declare function evaluateNarrativeWithGroq(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore>;
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