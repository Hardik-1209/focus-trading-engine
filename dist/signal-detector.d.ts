import type { Candle, HigherTimeframeTrend } from './indicators';
export type SignalAction = 'LONG' | 'SHORT' | 'WAIT';
export type SignalTier = 1 | 2 | 3;
export interface DetectedSignal {
    action: SignalAction;
    tier: SignalTier;
    skipLLM: boolean;
    indicators: {
        rsi: number;
        adx: number;
        atr: number;
        chop: number;
        vwap: number;
        macdHist: number;
        macdBullish: boolean;
        macdBearish: boolean;
        emaCrossover: boolean;
        ema50Bullish: boolean;
        aboveVWAP: boolean;
        volumeZ: number;
        latestClose: number;
        latestEMA: number;
        mtfTrend: HigherTimeframeTrend;
    };
    reason: string;
}
export declare function detectSignal(candles1m: Candle[], currentPrice: number, candles5m?: Candle[]): DetectedSignal;
//# sourceMappingURL=signal-detector.d.ts.map