"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectHottestCoin = selectHottestCoin;
exports.fetchCurrentPrice = fetchCurrentPrice;
exports.fetchBootstrapCandles = fetchBootstrapCandles;
/**
 * coin-selector.ts
 * Scans ALL Bitget USDT-futures tickers and picks the single highest-volatility coin.
 * Called at start and every 30 min (or on rotation trigger).
 */
const config_1 = require("./config");
const position_guardian_1 = require("./position-guardian");
const BITGET_REST = 'https://api.bitget.com/api/v2';
const TRADFI_BLOCKLIST = new Set([
    'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOG', 'META', 'NFLX',
    'COIN', 'MSTR', 'MU', 'AMD', 'INTC', 'BABA', 'NIO',
    'SPY', 'QQQ', 'DIA', 'INDEX', 'NDX', 'SPX', 'DJI',
    'XAU', 'XAG', 'WTI', 'OIL', 'GOLD', 'SILVER',
    'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
]);
/** Compute volatility score for ranking */
function scoreCandidate(change24h, volumeUsdt) {
    // Absolute 24h move × volume factor (log scale to prevent huge vol dominating)
    const volFactor = Math.log10(Math.max(volumeUsdt, 1));
    return Math.abs(change24h) * volFactor;
}
let lastSelectedSymbol = null;
async function selectHottestCoin() {
    console.log('[Coin Selector] Scanning Bitget futures for highest volatility coin...');
    const res = await fetch(`${BITGET_REST}/mix/market/tickers?productType=USDT-FUTURES`, {
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok)
        throw new Error(`Bitget tickers HTTP ${res.status}`);
    const json = await res.json();
    const tickers = json.data || [];
    const candidates = [];
    for (const t of tickers) {
        const sym = (t.symbol || '').toUpperCase();
        if (!sym.endsWith('USDT'))
            continue;
        if (sym.startsWith('USDT') || sym.startsWith('USDC') || sym.startsWith('USD'))
            continue;
        const base = sym.replace('USDT', '');
        if (TRADFI_BLOCKLIST.has(base))
            continue;
        const change24h = parseFloat(t.change24h || '0') * 100; // convert from decimal
        const lastPrice = parseFloat(t.lastPr || '0');
        const volumeUsdt = parseFloat(t.usdtVolume || t.quoteVolume || '0');
        if (isNaN(change24h) || lastPrice <= 0 || volumeUsdt < config_1.CONFIG.MIN_VOLUME_USDT)
            continue;
        if ((0, position_guardian_1.hasOpenPosition)(sym))
            continue;
        candidates.push({
            symbol: sym, base, lastPrice, change24h, volumeUsdt,
            score: scoreCandidate(change24h, volumeUsdt),
        });
    }
    if (candidates.length === 0)
        throw new Error('No valid candidates found from Bitget');
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    // Avoid re-selecting the same coin twice in a row
    let chosen = candidates[0];
    if (chosen.symbol === lastSelectedSymbol && candidates.length > 1) {
        chosen = candidates[1];
        console.log(`[Coin Selector] Skipping ${candidates[0].symbol} (just watched). Picking next: ${chosen.symbol}`);
    }
    lastSelectedSymbol = chosen.symbol;
    console.log(`[Coin Selector] 🎯 Selected: ${chosen.symbol} | ` +
        `24h: ${chosen.change24h > 0 ? '+' : ''}${chosen.change24h.toFixed(2)}% | ` +
        `Volume: $${(chosen.volumeUsdt / 1e6).toFixed(1)}M | ` +
        `Score: ${chosen.score.toFixed(1)}`);
    // Log top 5 for visibility
    console.log('[Coin Selector] Top 5 volatile coins right now:');
    candidates.slice(0, 5).forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.symbol.padEnd(14)} ${(c.change24h > 0 ? '+' : '') + c.change24h.toFixed(2).padStart(7)}% | ` +
            `Vol $${(c.volumeUsdt / 1e6).toFixed(1)}M | Score: ${c.score.toFixed(1)}`);
    });
    return chosen;
}
/** Fetch latest REST price for a symbol (used to bootstrap position guardian) */
async function fetchCurrentPrice(symbol) {
    const res = await fetch(`${BITGET_REST}/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`Price fetch failed: ${res.status}`);
    const json = await res.json();
    return parseFloat(json.data?.[0]?.lastPr || json.data?.lastPr || '0');
}
/** Fetch last N candles via REST (bootstrap only — after this we stream) */
async function fetchBootstrapCandles(symbol, limit = 60, granularity = '1m') {
    const res = await fetch(`${BITGET_REST}/mix/market/history-candles?symbol=${symbol}&productType=USDT-FUTURES&granularity=${granularity}&limit=${limit}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok)
        throw new Error(`Candle fetch failed: ${res.status}`);
    const json = await res.json();
    return (json.data || []).map((c) => ({
        timestamp: parseInt(c[0]),
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
    }));
}
//# sourceMappingURL=coin-selector.js.map