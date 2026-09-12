"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitgetWS = void 0;
/**
 * bitget-ws.ts
 * Persistent Bitget WebSocket client.
 * Subscribes to ticker + 1min candles for one coin.
 * Emits events: 'tick', 'candle1m', 'candle5m', 'connected', 'disconnected'
 */
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const WS_URL = 'wss://ws.bitget.com/v2/ws/public';
class BitgetWS extends events_1.EventEmitter {
    ws = null;
    symbol;
    pingTimer = null;
    reconnectTimer = null;
    shouldReconnect = true;
    reconnectDelay = 1000;
    // Rolling 1min candle buffer (latest 100 candles)
    candle1mBuffer = [];
    candle5mBuffer = [];
    constructor(symbol) {
        super();
        this.symbol = symbol;
    }
    /** Seed the buffer with historical candles fetched via REST */
    seedCandles(candles, timeframe = '1m') {
        if (timeframe === '1m')
            this.candle1mBuffer = [...candles].slice(-100);
        else
            this.candle5mBuffer = [...candles].slice(-100);
        console.log(`[WS] Seeded ${candles.length} ${timeframe} candles for ${this.symbol}`);
    }
    get candles1m() { return [...this.candle1mBuffer]; }
    get candles5m() { return [...this.candle5mBuffer]; }
    connect() {
        console.log(`[WS] Connecting to Bitget for ${this.symbol}...`);
        this.ws = new ws_1.default(WS_URL);
        this.ws.on('open', () => {
            console.log(`[WS] ✅ Connected. Subscribing to ${this.symbol} streams...`);
            this.reconnectDelay = 1000; // reset backoff
            this.subscribe();
            this.startPing();
            this.emit('connected', this.symbol);
        });
        this.ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.event === 'subscribe')
                    return; // ignore ack
                if (msg.data)
                    this.handleMessage(msg);
                else if (msg.event === 'error') {
                    console.error(`[WS] Error from Bitget:`, msg);
                }
                else {
                    console.log(`[WS] Unhandled message:`, msg);
                }
            }
            catch { /* ignore malformed */ }
        });
        this.ws.on('close', () => {
            console.warn(`[WS] ⚠️ Connection closed for ${this.symbol}`);
            this.stopPing();
            this.emit('disconnected', this.symbol);
            if (this.shouldReconnect)
                this.scheduleReconnect();
        });
        this.ws.on('error', (err) => {
            console.error(`[WS] Error: ${err.message}`);
            this.ws?.terminate();
        });
    }
    subscribe() {
        const args = [
            { instType: 'USDT-FUTURES', channel: 'ticker', instId: this.symbol },
            { instType: 'USDT-FUTURES', channel: 'candle1m', instId: this.symbol },
            { instType: 'USDT-FUTURES', channel: 'candle5m', instId: this.symbol },
        ];
        this.ws?.send(JSON.stringify({ op: 'subscribe', args }));
        console.log(`[WS] Subscribed: ticker + candle1m + candle5m for ${this.symbol}`);
    }
    handleMessage(msg) {
        const channel = msg.arg?.channel;
        if (channel === 'ticker') {
            const data = msg.data?.[0];
            if (!data)
                return;
            const tick = {
                symbol: this.symbol,
                lastPrice: parseFloat(data.lastPr || data.last || '0'),
                bestBid: parseFloat(data.bidPr || data.bid1 || '0'),
                bestAsk: parseFloat(data.askPr || data.ask1 || '0'),
                volume24h: parseFloat(data.baseVolume || data.vol24h || '0'),
                change24h: parseFloat(data.change24h || '0') * 100,
                ts: parseInt(data.ts || String(Date.now())),
            };
            this.emit('tick', tick);
        }
        else if (channel === 'candle1m') {
            if (!msg.data || !Array.isArray(msg.data))
                return;
            for (const d of msg.data) {
                const candle = this.parseCandle(d);
                if (candle)
                    this.upsertCandle(this.candle1mBuffer, candle);
            }
            this.candle1mBuffer.sort((a, b) => a.timestamp - b.timestamp);
            if (this.candle1mBuffer.length > 100)
                this.candle1mBuffer = this.candle1mBuffer.slice(-100);
            const latest = this.candle1mBuffer[this.candle1mBuffer.length - 1];
            if (latest && msg.action !== 'snapshot') {
                this.emit('candle1m', latest, [...this.candle1mBuffer]);
            }
            else if (latest && msg.action === 'snapshot') {
                this.emit('candle1m', latest, [...this.candle1mBuffer]);
            }
        }
        else if (channel === 'candle5m') {
            if (!msg.data || !Array.isArray(msg.data))
                return;
            for (const d of msg.data) {
                const candle = this.parseCandle(d);
                if (candle)
                    this.upsertCandle(this.candle5mBuffer, candle);
            }
            this.candle5mBuffer.sort((a, b) => a.timestamp - b.timestamp);
            if (this.candle5mBuffer.length > 100)
                this.candle5mBuffer = this.candle5mBuffer.slice(-100);
            const latest = this.candle5mBuffer[this.candle5mBuffer.length - 1];
            if (latest && msg.action !== 'snapshot') {
                this.emit('candle5m', latest, [...this.candle5mBuffer]);
            }
            else if (latest && msg.action === 'snapshot') {
                this.emit('candle5m', latest, [...this.candle5mBuffer]);
            }
        }
    }
    parseCandle(d) {
        if (!Array.isArray(d) || d.length < 6)
            return null;
        return {
            timestamp: parseInt(d[0]),
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
        };
    }
    upsertCandle(buf, candle) {
        const existingIdx = buf.findIndex(c => c.timestamp === candle.timestamp);
        if (existingIdx !== -1) {
            buf[existingIdx] = candle;
        }
        else {
            buf.push(candle);
        }
    }
    startPing() {
        this.pingTimer = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                this.ws.send('ping');
            }
        }, 20000);
    }
    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }
    scheduleReconnect() {
        const delay = Math.min(this.reconnectDelay, 30000);
        console.log(`[WS] Reconnecting in ${delay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
            this.connect();
        }, delay);
    }
    disconnect() {
        this.shouldReconnect = false;
        this.stopPing();
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
        console.log(`[WS] Disconnected from ${this.symbol}`);
    }
}
exports.BitgetWS = BitgetWS;
//# sourceMappingURL=bitget-ws.js.map