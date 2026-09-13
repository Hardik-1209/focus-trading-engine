import type { Candle, MarketRegime } from './indicators';
export type SignalAction = 'LONG' | 'SHORT' | 'WAIT';
export interface DetectedSignal {
    action: SignalAction;
    regime: MarketRegime;
    stopLossPrice: number;
    takeProfitPrice: number;
    plannedRR: number;
    atr: number;
    indicators: {
        rsi5m: number;
        atr5m: number;
        volumeZ5m: number;
        vwap5m: number;
        ema9_5m: number;
        ema21_5m: number;
        regime15m: MarketRegime;
        adx15m: number;
        chop15m: number;
        swingLow: number;
        swingHigh: number;
        currentPrice: number;
    };
    reason: string;
}
export declare function detectSignal(candles5m: Candle[], currentPrice: number, candles15m?: Candle[]): DetectedSignal;
//# sourceMappingURL=signal-detector.d.ts.map