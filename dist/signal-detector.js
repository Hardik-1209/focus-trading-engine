"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSignal = detectSignal;
/**
 * signal-detector.ts
 * Quantitative Multi-Timeframe Signal Engine with CHOP, VWAP, ATR & Volatility Confirmation.
 *
 * Tier 1 — High-Conviction Pullback: 5m MTF aligned + 1m Pullback + Non-Choppy (CHOP < 62) → Instant Execute
 * Tier 2 — Momentum Breakout: 5m MTF aligned + 1m Momentum Surge → Groq Cloud LLM Validation
 * Tier 3 — Chop / Counter-Trend: Ignore noise, wait for clean setup
 */
const config_1 = require("./config");
const indicators_1 = require("./indicators");
function detectSignal(candles1m, currentPrice, candles5m = []) {
    if (candles1m.length < 30) {
        return mkWait('Insufficient 1m candle history (<30)', candles1m, candles5m, currentPrice);
    }
    const ind = (0, indicators_1.computeAllIndicators)(candles1m, candles5m);
    const { latestRSI: rsi, latestADX: adx, latestATR: atr, latestCHOP: chop, latestVWAP: vwap, latestHist: macdHist, prevHist, macdBullish, macdBearish, macdCrossUp, macdCrossDown, emaCrossover, ema50Bullish, aboveVWAP, isChoppy, latestZScore: volumeZ, latestClose, latestEMA, mtfTrend, } = ind;
    const indicators = {
        rsi, adx, atr, chop, vwap, macdHist, macdBullish, macdBearish,
        emaCrossover, ema50Bullish, aboveVWAP, volumeZ, latestClose, latestEMA, mtfTrend,
    };
    // ─── FILTER: Choppiness Index (CHOP > 62 = Sideways Ranging) ─────────────────
    if (isChoppy) {
        return mkWait(`Market choppy/consolidating (CHOP=${chop.toFixed(1)}>62). Awaiting directional expansion.`, candles1m, candles5m, currentPrice);
    }
    // ─── FILTER: Higher Timeframe (5m) Trend Alignment ──────────────────────────
    const allowLong = !config_1.SIGNAL.USE_5M_FILTER || mtfTrend !== 'BEARISH';
    const allowShort = !config_1.SIGNAL.USE_5M_FILTER || mtfTrend !== 'BULLISH';
    // ─── TIER 1: HIGH CONVICTION PULLBACK (Instant Execution) ───────────────────
    // Strong uptrend (5m Bullish + 1m ADX > 22 + Price >= VWAP), Price dips temporarily, Volume expands
    if (allowLong &&
        mtfTrend === 'BULLISH' &&
        rsi <= 48 &&
        rsi >= 30 &&
        aboveVWAP &&
        (macdBullish || macdCrossUp) &&
        emaCrossover &&
        adx >= 20 &&
        volumeZ >= 0.8) {
        return {
            action: 'LONG',
            tier: 1,
            skipLLM: true,
            indicators,
            reason: `TIER1 PULLBACK LONG: 5M=BULLISH, RSI=${rsi.toFixed(1)}, Price>VWAP, ADX=${adx.toFixed(1)}, VolZ=${volumeZ.toFixed(2)}`,
        };
    }
    // Strong downtrend (5m Bearish + 1m ADX > 22 + Price <= VWAP), Price rallies temporarily, Volume expands
    if (allowShort &&
        mtfTrend === 'BEARISH' &&
        rsi >= 52 &&
        rsi <= 70 &&
        !aboveVWAP &&
        (macdBearish || macdCrossDown) &&
        !emaCrossover &&
        adx >= 20 &&
        volumeZ >= 0.8) {
        return {
            action: 'SHORT',
            tier: 1,
            skipLLM: true,
            indicators,
            reason: `TIER1 PULLBACK SHORT: 5M=BEARISH, RSI=${rsi.toFixed(1)}, Price<VWAP, ADX=${adx.toFixed(1)}, VolZ=${volumeZ.toFixed(2)}`,
        };
    }
    // ─── TIER 2: MOMENTUM BREAKOUT (Confirm with Groq Cloud LLM) ─────────────────
    // Bullish momentum surge: 5m is not bearish, 1m RSI expanding (50-68), MACD improving
    if (allowLong &&
        rsi >= 50 &&
        rsi <= 68 &&
        macdHist > prevHist &&
        macdHist > 0 &&
        emaCrossover &&
        adx >= 18) {
        return {
            action: 'LONG',
            tier: 2,
            skipLLM: false,
            indicators,
            reason: `TIER2 MOMENTUM LONG: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, MACD expanding, ADX=${adx.toFixed(1)} — sending to Groq LLM`,
        };
    }
    // Bearish momentum surge: 5m is not bullish, 1m RSI contracting (32-50), MACD deteriorating
    if (allowShort &&
        rsi <= 50 &&
        rsi >= 32 &&
        macdHist < prevHist &&
        macdHist < 0 &&
        !emaCrossover &&
        adx >= 18) {
        return {
            action: 'SHORT',
            tier: 2,
            skipLLM: false,
            indicators,
            reason: `TIER2 MOMENTUM SHORT: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, MACD expanding down, ADX=${adx.toFixed(1)} — sending to Groq LLM`,
        };
    }
    // ─── TIER 3: WAIT ────────────────────────────────────────────────────────────
    return mkWait(`1m candle ($${currentPrice.toFixed(4)}) → No confluence. 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, CHOP=${chop.toFixed(1)}, ADX=${adx.toFixed(1)}`, candles1m, candles5m, currentPrice);
}
function mkWait(reason, candles1m, candles5m, price) {
    const ind = candles1m.length >= 30
        ? (0, indicators_1.computeAllIndicators)(candles1m, candles5m)
        : {
            latestRSI: 50, latestADX: 0, latestATR: price * 0.01, latestCHOP: 50, latestVWAP: price,
            latestHist: 0, macdBullish: false, macdBearish: false, emaCrossover: false,
            ema50Bullish: false, aboveVWAP: true, latestZScore: 0, latestClose: price, latestEMA: price,
            prevHist: 0, mtfTrend: 'NEUTRAL',
        };
    return {
        action: 'WAIT',
        tier: 3,
        skipLLM: true,
        indicators: {
            rsi: ind.latestRSI,
            adx: ind.latestADX,
            atr: ind.latestATR,
            chop: ind.latestCHOP,
            vwap: ind.latestVWAP,
            macdHist: ind.latestHist,
            macdBullish: ind.macdBullish,
            macdBearish: ind.macdBearish,
            emaCrossover: ind.emaCrossover,
            ema50Bullish: ind.ema50Bullish,
            aboveVWAP: ind.aboveVWAP,
            volumeZ: ind.latestZScore,
            latestClose: ind.latestClose,
            latestEMA: ind.latestEMA,
            mtfTrend: ind.mtfTrend,
        },
        reason,
    };
}
//# sourceMappingURL=signal-detector.js.map