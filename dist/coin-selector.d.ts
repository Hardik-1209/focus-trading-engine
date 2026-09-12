export interface CoinCandidate {
    symbol: string;
    base: string;
    lastPrice: number;
    change24h: number;
    volumeUsdt: number;
    score: number;
}
export declare function selectHottestCoin(): Promise<CoinCandidate>;
/** Fetch latest REST price for a symbol (used to bootstrap position guardian) */
export declare function fetchCurrentPrice(symbol: string): Promise<number>;
/** Fetch last N candles via REST (bootstrap only — after this we stream) */
export declare function fetchBootstrapCandles(symbol: string, limit?: number, granularity?: '1m' | '5m'): Promise<any[]>;
//# sourceMappingURL=coin-selector.d.ts.map