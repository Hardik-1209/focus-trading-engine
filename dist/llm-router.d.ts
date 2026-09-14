import { NarrativeScore, RiskVerdict, RiskParams } from './groq-client';
export type LlmProvider = 'gemini' | 'groq' | 'rule-based';
export declare function evaluateNarrative(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore & {
    llmSource: LlmProvider;
}>;
export declare function evaluateRiskVerdict(params: RiskParams): Promise<RiskVerdict & {
    llmSource: LlmProvider;
}>;
export type { NarrativeScore, RiskVerdict, RiskParams };
//# sourceMappingURL=llm-router.d.ts.map