/**
 * llm-router.ts
 * Cloud LLM Router — High-speed reasoning via Groq with smart key rotation.
 */
import { NarrativeScore, RiskVerdict, RiskParams } from './groq-client';
export declare function evaluateNarrative(symbol: string, description: string, skillContext?: string): Promise<NarrativeScore & {
    llmSource: 'groq' | 'rule-based';
}>;
export declare function evaluateRiskVerdict(params: RiskParams): Promise<RiskVerdict & {
    llmSource: 'groq' | 'rule-based';
}>;
export type { NarrativeScore, RiskVerdict, RiskParams };
//# sourceMappingURL=llm-router.d.ts.map