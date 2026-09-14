"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTopCandidateBasket = getTopCandidateBasket;
exports.selectHottestCoin = selectHottestCoin;
exports.fetchCurrentPrice = fetchCurrentPrice;
exports.fetchBootstrapCandles = fetchBootstrapCandles;
/**
 * coin-selector.ts (v3.0)
 * Scans Bitget USDT-futures tickers with institutional liquidity, spread,
 * volatility, and Risk Governor circuit-breaker validation.
 */
const config_1 = require("./config");
const risk_governor_1 = require("./risk-governor");
const BITGET_REST = 'https://api.bitget.com/api/v2';
const TRADFI_BLOCKLIST = new Set([
    'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOG', 'META', 'NFLX',
    'COIN', 'MSTR', 'MU', 'AMD', 'INTC', 'BABA', 'NIO',
    'SPY', 'QQQ', 'DIA', 'INDEX', 'NDX', 'SPX', 'DJI',
    'XAU', 'XAG', 'WTI', 'OIL', 'GOLD', 'SILVER',
    'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY',
]);
const INSTITUTIONAL_PRIORITY_COINS = new Set([
    'SOL', 'BTC', 'ETH', 'DOGE', 'XRP', 'SUI', 'LINK', 'AVAX',
    'NEAR', 'ADA', 'BNB', 'APT', 'ARB', 'OP', 'PEPE', 'SHIB',
    'TIA', 'RENDER', 'INJ', 'FET', 'ENA', 'WIF', 'SEI', 'AAVE',
]);
/** Compute volatility and liquidity score for ranking */
function scoreCandidate(base, change24h, volumeUsdt) {
    // Absolute 24h move × volume factor (log scale)
    const volFactor = Math.log10(Math.max(volumeUsdt, 1));
    const baseScore = Math.abs(change24h) * volFactor;
    // Modest boost for established institutional assets with deep order books
    return INSTITUTIONAL_PRIORITY_COINS.has(base) ? baseScore * 1.3 : baseScore;
}
let lastSelectedSymbol = null;
async function getTopCandidateBasket(limit = config_1.CONFIG.MAX_CANDIDATES_POOL) {
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
        // Strict symbol format: only uppercase alphanumeric letters (rejects exotic/unicode coins like 龙虾USDT)
        if (!/^[A-Z0-9]+USDT$/.test(sym))
            continue;
        const base = sym.replace('USDT', '');
        if (TRADFI_BLOCKLIST.has(base))
            continue;
        // Check circuit breaker status
        const governorCheck = risk_governor_1.riskGovernor.canTradeSymbol(sym);
        if (!governorCheck.allowed)
            continue;
        const change24h = parseFloat(t.change24h || '0') * 100;
        const lastPrice = parseFloat(t.lastPr || '0');
        const volumeUsdt = parseFloat(t.usdtVolume || t.quoteVolume || '0');
        // Strict Liquidity Floor ($15M USDT min 24h volume)
        if (isNaN(change24h) || lastPrice <= 0 || volumeUsdt < config_1.CONFIG.MIN_VOLUME_USDT)
            continue;
        // Microstructure Spread Floor (<0.15%)
        const bidPr = parseFloat(t.bidPr || '0');
        const askPr = parseFloat(t.askPr || '0');
        let spreadPct = 0;
        if (bidPr > 0 && askPr > 0) {
            spreadPct = (askPr - bidPr) / bidPr;
            if (spreadPct > config_1.RISK.MAX_SPREAD_PCT)
                continue;
        }
        candidates.push({
            symbol: sym,
            base,
            lastPrice,
            change24h,
            volumeUsdt,
            spreadPct,
            score: scoreCandidate(base, change24h, volumeUsdt),
        });
    }
    if (candidates.length === 0) {
        throw new Error('No liquid candidates found meeting liquidity floor');
    }
    // Sort descending by momentum score
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit);
}
async function selectHottestCoin() {
    const basket = await getTopCandidateBasket(config_1.CONFIG.MAX_CANDIDATES_POOL);
    let chosen = basket[0];
    if (chosen.symbol === lastSelectedSymbol && basket.length > 1) {
        chosen = basket[1];
    }
    lastSelectedSymbol = chosen.symbol;
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
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(`${BITGET_REST}/mix/market/history-candles?symbol=${symbol}&productType=USDT-FUTURES&granularity=${granularity}&limit=${limit}`, { signal: AbortSignal.timeout(8000) });
            if (res.status === 429) {
                await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
                continue;
            }
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
        catch (err) {
            if (attempt === 2)
                throw err;
            await new Promise(r => setTimeout(r, 300));
        }
    }
    return [];
}
//# sourceMappingURL=coin-selector.js.map