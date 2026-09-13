/**
 * indicators.ts (v3.0)
 * Quantitative Indicator & Market Structure Engine
 *
 * Computes:
 * - 15m Structural Regime (EMA 21/50, ADX 14, CHOP 14, VWAP)
 * - 5m Trigger Dynamics (Pullbacks, Rejection wicks, RSI, Volume Z-Score, ATR)
 * - Swing High / Low structural support & resistance detection
 */
export interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface MACDResult {
    macdLine: number[];
    signalLine: number[];
    histogram: number[];
}
export declare function calculateEMA(prices: number[], period: number): number[];
export declare function calculateRSI(closes: number[], period?: number): number[];
export declare function calculateMACD(closes: number[], fast?: number, slow?: number, signal?: number): MACDResult;
export declare function calculateADX(candles: Candle[], period?: number): number[];
export declare function calculateATR(candles: Candle[], period?: number): number[];
export declare function calculateVolumeZScores(volumes: number[], period?: number): number[];
/**
 * Choppiness Index (CHOP)
 * Range: 0 to 100. > 58 = Choppy / Sideways, < 42 = Strong Trend
 */
export declare function calculateCHOP(candles: Candle[], period?: number): number[];
/** Volume-Weighted Average Price (VWAP) */
export declare function calculateVWAP(candles: Candle[]): number[];
/** Structural Swing Levels (Support & Resistance) */
export declare function findSwingLow(candles: Candle[], lookback?: number): number;
export declare function findSwingHigh(candles: Candle[], lookback?: number): number;
export type MarketRegime = 'TRENDING_BULL' | 'TRENDING_BEAR' | 'RANGING' | 'VOLATILE_CHOP';
export declare function computeRegime15m(candles15m: Candle[]): {
    regime: MarketRegime;
    ema21: number;
    ema50: number;
    adx15m: number;
    chop15m: number;
    vwap15m: number;
};
//# sourceMappingURL=indicators.d.ts.map