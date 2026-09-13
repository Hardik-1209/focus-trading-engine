export interface SymbolStreak {
    consecutiveLosses: number;
    lastTradeTime: number;
    cooldownUntil: number;
    totalTrades: number;
    netPnl: number;
}
export interface RiskGovernorStatus {
    dailyHalted: boolean;
    dailyStartingBalance: number;
    dailyRealizedPnl: number;
    dailyDrawdownPct: number;
    activeCooldowns: Array<{
        symbol: string;
        cooldownRemainingMin: number;
        consecutiveLosses: number;
    }>;
    rollingExpectancy: number;
    rollingWinRate: number;
    llmTotalEvaluations: number;
    llmApprovals: number;
    llmApprovalRate: number;
    version: string;
}
declare class RiskGovernor {
    private symbolStreaks;
    private dailyStartingBalance;
    private dailyRealizedPnl;
    private dailyHalted;
    private dailyResetDate;
    private recentTrades;
    private llmTotal;
    private llmApproved;
    constructor();
    private checkDayRoll;
    setStartingBalance(balance: number): void;
    /**
     * Evaluates whether an asset is permissible to trade.
     * Checks daily portfolio kill switch and symbol-level circuit breakers.
     */
    canTradeSymbol(symbol: string): {
        allowed: boolean;
        reason?: string;
    };
    /**
     * Called on every position closure to update streaks and drawdown.
     */
    recordTradeOutcome(symbol: string, pnl: number, isWin: boolean): void;
    /**
     * Records LLM evaluation results to monitor approval rate.
     */
    recordLlmDecision(approved: boolean): void;
    getStatus(): RiskGovernorStatus;
}
export declare const riskGovernor: RiskGovernor;
export {};
//# sourceMappingURL=risk-governor.d.ts.map