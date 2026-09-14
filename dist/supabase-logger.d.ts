export declare function logHealth(params: {
    event_type: string;
    component: string;
    severity: 'INFO' | 'WARNING' | 'ERROR';
    message: string;
    meta_data?: Record<string, any>;
}): Promise<void>;
export declare function getLatestInMemoryStatus(): Record<string, any>;
/** Reset in-memory telemetry to clean slate values for a new version */
export declare function resetInMemoryStatus(version?: string): void;
export declare function updateEngineStatus(status: {
    focused_symbol?: string;
    cycle_count?: number;
    active_trades_count?: number;
    active_groq_key_index?: number;
    is_running?: boolean;
    live_indicators?: Record<string, any>;
}): Promise<void>;
export declare function logMarketSignal(params: {
    symbol: string;
    action: string;
    tier: number;
    approved: boolean;
    llm_source?: string;
    confidence?: number;
    indicators: Record<string, any>;
    reason: string;
}): Promise<void>;
export declare function fetchWalletBalance(): Promise<number>;
export declare function adjustWalletBalanceAtomic(pnlDelta: number): Promise<void>;
export declare function fetchCurrentEngineCycle(): Promise<number>;
export declare function getActiveSessionId(): Promise<string>;
export declare function insertFuturesTrade(params: {
    symbol: string;
    position_side: 'LONG' | 'SHORT';
    amount: number;
    entry_price: number;
    status: 'OPEN' | 'FAILED';
    tier?: number;
    llm_source?: string;
    ai_reasoning?: string;
    indicators_at_entry?: Record<string, any>;
    session_id?: string;
    take_profit_price?: number;
    stop_loss_price?: number;
    trailing_stop_pct?: number;
    atr?: number;
    pipeline_candidate_id?: string;
}): Promise<string>;
export declare function fetchOpenFuturesTrades(): Promise<any[]>;
export declare function updateFuturesTrade(id: string, updates: {
    status?: 'OPEN' | 'CLOSED' | 'FAILED';
    exit_price?: number;
    realized_pnl?: number;
    closed_at?: string;
    exit_reason?: string;
    fee?: number;
    return_pct?: number;
}): Promise<void>;
export declare function checkRecentTrade(symbol: string, windowMs?: number): Promise<boolean>;
export declare function logFocusEvent(params: {
    event_type: string;
    symbol: string;
    tier?: number;
    llm_source?: string;
    action?: string;
    indicators?: Record<string, any>;
    message: string;
}): Promise<void>;
//# sourceMappingURL=supabase-logger.d.ts.map