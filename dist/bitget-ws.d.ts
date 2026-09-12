import { EventEmitter } from 'events';
import type { Candle } from './indicators';
export interface TickData {
    symbol: string;
    lastPrice: number;
    bestBid: number;
    bestAsk: number;
    volume24h: number;
    change24h: number;
    ts: number;
}
export declare class BitgetWS extends EventEmitter {
    private ws;
    private symbol;
    private pingTimer;
    private reconnectTimer;
    private shouldReconnect;
    private reconnectDelay;
    private candle1mBuffer;
    private candle5mBuffer;
    constructor(symbol: string);
    /** Seed the buffer with historical candles fetched via REST */
    seedCandles(candles: Candle[], timeframe?: '1m' | '5m'): void;
    get candles1m(): Candle[];
    get candles5m(): Candle[];
    connect(): void;
    private subscribe;
    private handleMessage;
    private parseCandle;
    private upsertCandle;
    private startPing;
    private stopPing;
    private scheduleReconnect;
    disconnect(): void;
}
//# sourceMappingURL=bitget-ws.d.ts.map