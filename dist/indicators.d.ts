/**
 * indicators.ts
 * Quantitative indicator engine — EMA, RSI, MACD, ADX, ATR, Volume Z-Score, Choppiness Index (CHOP), VWAP, and MTF Trend.
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
 * Range: 0 to 100
 * > 61.8 = Market is consolidating / choppy
 * < 38.2 = Market is trending strongly
 */
export declare function calculateCHOP(candles: Candle[], period?: number): number[];
/**
 * Volume-Weighted Average Price (VWAP)
 */
export declare function calculateVWAP(candles: Candle[]): number[];
export type HigherTimeframeTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export declare function computeMTFTrend(candles5m: Candle[]): {
    trend: HigherTimeframeTrend;
    emaFast: number;
    emaSlow: number;
    rsi5m: number;
};
/** Derive all signals and filters from candle arrays */
export declare function computeAllIndicators(candles1m: Candle[], candles5m?: Candle[]): {
    latestClose: number;
    latestEMA: number;
    latestEMA50: number;
    latestRSI: number;
    latestADX: number;
    latestATR: number;
    latestZScore: number;
    latestCHOP: number;
    latestVWAP: number;
    latestMACD: number;
    latestSignal: number;
    latestHist: number;
    prevHist: number;
    isChoppy: boolean;
    aboveVWAP: boolean;
    emaCrossover: boolean;
    ema50Bullish: boolean;
    rsiOversold: boolean;
    rsiOverbought: boolean;
    macdBullish: boolean;
    macdBearish: boolean;
    macdCrossUp: boolean;
    macdCrossDown: boolean;
    mtfTrend: HigherTimeframeTrend;
    mtfRsi: number;
};
//# sourceMappingURL=indicators.d.ts.map