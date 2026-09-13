"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectHottestCoin = selectHottestCoin;
exports.fetchCurrentPrice = fetchCurrentPrice;
exports.fetchBootstrapCandles = fetchBootstrapCandles;
/**
 * coin-selector.ts (v3.0)
 * Scans Bitget USDT-futures tickers with institutional liquidity, spread,
 * volatility, and Risk Governor circuit-breaker validation.
 */
const config_1 = require("./config");
const position_guardian_1 = require("./position-guardian");
const risk_governor_1 = require("./risk-governor");
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
    // Absolute 24h move × volume factor (log scale)
    const volFactor = Math.log10(Math.max(volumeUsdt, 1));
    return Math.abs(change24h) * volFactor;
}
let lastSelectedSymbol = null;
async function selectHottestCoin() {
    console.log('[Coin Selector v3.0] Scanning Bitget futures for liquid, high-momentum candidates...');
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
        // Check circuit breaker status
        const governorCheck = risk_governor_1.riskGovernor.canTradeSymbol(sym);
        if (!governorCheck.allowed) {
            continue;
        }
        const change24h = parseFloat(t.change24h || '0') * 100;
        const lastPrice = parseFloat(t.lastPr || '0');
        const volumeUsdt = parseFloat(t.usdtVolume || t.quoteVolume || '0');
        // 1. Strict Liquidity Floor ($5M USDT min 24h volume)
        if (isNaN(change24h) || lastPrice <= 0 || volumeUsdt < config_1.CONFIG.MIN_VOLUME_USDT)
            continue;
        if ((0, position_guardian_1.hasOpenPosition)(sym))
            continue;
        // 2. Microstructure Spread Floor
        const bidPr = parseFloat(t.bidPr || '0');
        const askPr = parseFloat(t.askPr || '0');
        let spreadPct = 0;
        if (bidPr > 0 && askPr > 0) {
            spreadPct = (askPr - bidPr) / bidPr;
            if (spreadPct > config_1.RISK.MAX_SPREAD_PCT) {
                continue; // Reject illiquid wide-spread coins
            }
        }
        candidates.push({
            symbol: sym,
            base,
            lastPrice,
            change24h,
            volumeUsdt,
            spreadPct,
            score: scoreCandidate(change24h, volumeUsdt),
        });
    }
    if (candidates.length === 0) {
        throw new Error('No liquid candidates found meeting v3.0 criteria ($5M+ vol, <0.15% spread, circuit breakers clear)');
    }
    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);
    // Avoid re-selecting the same coin twice in a row if alternatives exist
    let chosen = candidates[0];
    if (chosen.symbol === lastSelectedSymbol && candidates.length > 1) {
        chosen = candidates[1];
        console.log(`[Coin Selector] Rotating from ${candidates[0].symbol} (just watched) -> ${chosen.symbol}`);
    }
    lastSelectedSymbol = chosen.symbol;
    // Fetch funding rate for chosen candidate
    try {
        const frRes = await fetch(`${BITGET_REST}/mix/market/current-fund-rate?symbol=${chosen.symbol}&productType=USDT-FUTURES`, {
            signal: AbortSignal.timeout(5000),
        });
        if (frRes.ok) {
            const frJson = await frRes.json();
            const rate = parseFloat(frJson.data?.[0]?.fundingRate || '0');
            chosen.fundingRate = rate;
        }
    }
    catch {
        // Non-critical
    }
    console.log(`[Coin Selector v3.0] 🎯 Selected: ${chosen.symbol} | ` +
        `24h: ${chosen.change24h > 0 ? '+' : ''}${chosen.change24h.toFixed(2)}% | ` +
        `Vol: $${(chosen.volumeUsdt / 1e6).toFixed(1)}M | ` +
        `Spread: ${(chosen.spreadPct * 100).toFixed(3)}% | ` +
        `Funding: ${chosen.fundingRate !== undefined ? (chosen.fundingRate * 100).toFixed(4) + '%' : 'N/A'}`);
    return chosen;
}
/** Fetch latest REST price for a symbol */
async function fetchCurrentPrice(symbol) {
    const res = await fetch(`${BITGET_REST}/mix/market/ticker?symbol=${symbol}&productType=USDT-FUTURES`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok)
        throw new Error(`Price fetch failed: ${res.status}`);
    const json = await res.json();
    return parseFloat(json.data?.[0]?.lastPr || json.data?.lastPr || '0');
}
/** Fetch last N candles via REST (bootstrap only — after this we stream) */
async function fetchBootstrapCandles(symbol, limit = 60, granularity = '5m') {
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