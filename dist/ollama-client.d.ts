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
/** Check if Ollama is running and the model is loaded */
export declare function isOllamaReady(): Promise<boolean>;
/** Reset the availability cache (called after Ollama reconnect) */
export declare function resetOllamaCache(): void;
export declare function evaluateNarrativeWithOllama(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore>;
export declare function evaluateRiskVerdictWithOllama(params: {
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
}): Promise<RiskVerdict>;
//# sourceMappingURL=ollama-client.d.ts.map