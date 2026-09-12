/**
 * indicators.ts
 * Quantitative indicator engine — EMA, RSI, MACD, ADX, ATR, Volume Z-Score, and MTF Trend.
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
export declare function calculateVolumeZScores(volumes: number[], period: number): number[];
export type HigherTimeframeTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
/** Compute Higher Timeframe (5m) Macro Trend */
export declare function computeMTFTrend(candles5m: Candle[]): {
    trend: HigherTimeframeTrend;
    emaFast: number;
    emaSlow: number;
    rsi5m: number;
};
/** Derive all signals from a candle array in one call */
export declare function computeAllIndicators(candles1m: Candle[], candles5m?: Candle[]): {
    latestClose: number;
    latestEMA: number;
    latestEMA50: number;
    latestRSI: number;
    latestADX: number;
    latestATR: number;
    latestZScore: number;
    latestMACD: number;
    latestSignal: number;
    latestHist: number;
    prevHist: number;
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