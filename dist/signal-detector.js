"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSignal = detectSignal;
/**
 * signal-detector.ts
 * Quantitative Multi-Timeframe Signal Engine with ATR & Volatility Confirmation.
 *
 * Tier 1 — High-Conviction Trend Pullback: 5m MTF aligned + 1m Pullback + Volume Expansion → Instant Execute
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
    const { latestRSI: rsi, latestADX: adx, latestATR: atr, latestHist: macdHist, prevHist, macdBullish, macdBearish, macdCrossUp, macdCrossDown, emaCrossover, ema50Bullish, latestZScore: volumeZ, latestClose, latestEMA, mtfTrend, } = ind;
    const indicators = {
        rsi, adx, atr, macdHist, macdBullish, macdBearish,
        emaCrossover, ema50Bullish, volumeZ, latestClose, latestEMA, mtfTrend,
    };
    // ─── FILTER: Higher Timeframe (5m) Trend Alignment ──────────────────────────
    const allowLong = !config_1.SIGNAL.USE_5M_FILTER || mtfTrend !== 'BEARISH';
    const allowShort = !config_1.SIGNAL.USE_5M_FILTER || mtfTrend !== 'BULLISH';
    // ─── TIER 1: HIGH CONVICTION PULLBACK (Instant Execution) ───────────────────
    // Strong uptrend (5m Bullish/Neutral + 1m ADX > 25), Price dips temporarily, Volume spikes
    if (allowLong &&
        mtfTrend === 'BULLISH' &&
        rsi < config_1.SIGNAL.RSI_PULLBACK_LONG &&
        (macdBullish || macdCrossUp) &&
        emaCrossover &&
        ema50Bullish &&
        adx >= config_1.SIGNAL.ADX_STRONG &&
        volumeZ >= config_1.SIGNAL.VOLUME_ZSCORE_MIN) {
        return {
            action: 'LONG',
            tier: 1,
            skipLLM: true,
            indicators,
            reason: `TIER1 5M-ALIGNED PULLBACK LONG: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}<${config_1.SIGNAL.RSI_PULLBACK_LONG}, ADX=${adx.toFixed(1)}, VolZ=${volumeZ.toFixed(2)}`,
        };
    }
    // Strong downtrend (5m Bearish/Neutral + 1m ADX > 25), Price rallies temporarily, Volume spikes
    if (allowShort &&
        mtfTrend === 'BEARISH' &&
        rsi > config_1.SIGNAL.RSI_PULLBACK_SHORT &&
        (macdBearish || macdCrossDown) &&
        !emaCrossover &&
        !ema50Bullish &&
        adx >= config_1.SIGNAL.ADX_STRONG &&
        volumeZ >= config_1.SIGNAL.VOLUME_ZSCORE_MIN) {
        return {
            action: 'SHORT',
            tier: 1,
            skipLLM: true,
            indicators,
            reason: `TIER1 5M-ALIGNED PULLBACK SHORT: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}>${config_1.SIGNAL.RSI_PULLBACK_SHORT}, ADX=${adx.toFixed(1)}, VolZ=${volumeZ.toFixed(2)}`,
        };
    }
    // ─── TIER 2: MOMENTUM BREAKOUT (Confirm with Groq Cloud LLM) ─────────────────
    // Bullish continuation: 5m is not bearish, 1m RSI in expansion zone (52-68), MACD expanding
    if (allowLong &&
        rsi >= config_1.SIGNAL.RSI_TREND_LONG &&
        rsi <= 68 &&
        macdHist > prevHist &&
        macdHist > 0 &&
        emaCrossover &&
        adx >= config_1.SIGNAL.ADX_WEAK &&
        volumeZ >= 0.5) {
        return {
            action: 'LONG',
            tier: 2,
            skipLLM: false,
            indicators,
            reason: `TIER2 MOMENTUM LONG: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, MACD expanding, ADX=${adx.toFixed(1)} — sending to Groq LLM`,
        };
    }
    // Bearish continuation: 5m is not bullish, 1m RSI in contraction zone (32-48), MACD deteriorating
    if (allowShort &&
        rsi <= config_1.SIGNAL.RSI_TREND_SHORT &&
        rsi >= 32 &&
        macdHist < prevHist &&
        macdHist < 0 &&
        !emaCrossover &&
        adx >= config_1.SIGNAL.ADX_WEAK &&
        volumeZ >= 0.5) {
        return {
            action: 'SHORT',
            tier: 2,
            skipLLM: false,
            indicators,
            reason: `TIER2 MOMENTUM SHORT: 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, MACD expanding down, ADX=${adx.toFixed(1)} — sending to Groq LLM`,
        };
    }
    // ─── TIER 3: WAIT ────────────────────────────────────────────────────────────
    return mkWait(`1m candle ($${currentPrice.toFixed(4)}) → No confluence. 5M=${mtfTrend}, RSI=${rsi.toFixed(1)}, ADX=${adx.toFixed(1)}, MACD=${macdHist > 0 ? 'bull' : 'bear'}`, candles1m, candles5m, currentPrice);
}
function mkWait(reason, candles1m, candles5m, price) {
    const ind = candles1m.length >= 30
        ? (0, indicators_1.computeAllIndicators)(candles1m, candles5m)
        : {
            latestRSI: 50, latestADX: 0, latestATR: price * 0.01, latestHist: 0,
            macdBullish: false, macdBearish: false, emaCrossover: false, ema50Bullish: false,
            latestZScore: 0, latestClose: price, latestEMA: price, prevHist: 0,
            mtfTrend: 'NEUTRAL',
        };
    return {
        action: 'WAIT',
        tier: 3,
        skipLLM: true,
        indicators: {
            rsi: ind.latestRSI,
            adx: ind.latestADX,
            atr: ind.latestATR,
            macdHist: ind.latestHist,
            macdBullish: ind.macdBullish,
            macdBearish: ind.macdBearish,
            emaCrossover: ind.emaCrossover,
            ema50Bullish: ind.ema50Bullish,
            volumeZ: ind.latestZScore,
            latestClose: ind.latestClose,
            latestEMA: ind.latestEMA,
            mtfTrend: ind.mtfTrend,
        },
        reason,
    };
}
//# sourceMappingURL=signal-detector.js.map