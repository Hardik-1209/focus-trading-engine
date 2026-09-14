import type { TickData } from './bitget-ws';
export interface ActivePosition {
    tradeId: string;
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    entryPrice: number;
    amount: number;
    openedAt: number;
    peakPrice: number;
    atr?: number;
    trailingStopPct?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
    isBreakevenSet?: boolean;
    tier?: number;
    llmSource?: string;
    isClosing?: boolean;
}
export declare function displayActiveTrades(): void;
export declare function syncOpenPositions(): Promise<void>;
export declare function hasOpenPosition(symbol: string): boolean;
export declare function getOpenPosition(symbol: string): ActivePosition | undefined;
export declare function getActivePositionsCount(): number;
export declare function getActivePositionsList(): ActivePosition[];
export declare function updatePositionStopLoss(symbol: string, newStopLoss: number): boolean;
export declare function registerPosition(params: {
    tradeId: string;
    symbol: string;
    positionSide: 'LONG' | 'SHORT';
    entryPrice: number;
    amount: number;
    atr?: number;
    trailingStopPct?: number;
    takeProfitPrice?: number;
    stopLossPrice?: number;
    tier?: number;
    llmSource?: string;
}): void;
/** Called on every WebSocket tick — evaluates all open positions */
export declare function onTick(tick: TickData): Promise<void>;
/** Close position in DB, adjust wallet balance, update Risk Governor, and log */
export declare function closePosition(pos: ActivePosition, exitPrice: number, reason: string): Promise<void>;
//# sourceMappingURL=position-guardian.d.ts.map