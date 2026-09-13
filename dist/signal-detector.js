"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectSignal = detectSignal;
/**
 * signal-detector.ts (v3.0)
 * Quantitative Multi-Timeframe Structural Pullback Engine
 *
 * Implements:
 * 1. 15-minute Trend & Regime Confirmation (HMM / Structural Trend Alignment)
 * 2. 5-minute Pullback & Value-Zone Rejection
 * 3. Dynamic Triple Barrier Target Geometry (Structural Stop + 1.8x ATR, Target 3.2x ATR)
 * 4. Microstructure Volume Z-Score Expansion
 */
const config_1 = require("./config");
const indicators_1 = require("./indicators");
function detectSignal(candles5m, currentPrice, candles15m = []) {
    if (candles5m.length < 20 || candles15m.length < 20) {
        return mkWait('Insufficient historical candles (need >=20 x 5m and 15m)', currentPrice, 'RANGING');
    }
    // 1. 15-Minute Regime Classification
    const { regime, adx15m, chop15m } = (0, indicators_1.computeRegime15m)(candles15m);
    if (regime === 'VOLATILE_CHOP') {
        return mkWait(`Market in volatile chop on 15m (CHOP=${chop15m.toFixed(1)}>58, ADX=${adx15m.toFixed(1)}). Capital protected.`, currentPrice, regime);
    }
    if (regime === 'RANGING') {
        return mkWait(`Market in horizontal ranging state on 15m. Awaiting directional breakout.`, currentPrice, regime);
    }
    // 2. 5-Minute Technical Indicators
    const closes5m = candles5m.map(c => c.close);
    const volumes5m = candles5m.map(c => c.volume);
    const ema9Arr = (0, indicators_1.calculateEMA)(closes5m, 9);
    const ema21Arr = (0, indicators_1.calculateEMA)(closes5m, 21);
    const rsiArr = (0, indicators_1.calculateRSI)(closes5m, 14);
    const atrArr = (0, indicators_1.calculateATR)(candles5m, 14);
    const zArr = (0, indicators_1.calculateVolumeZScores)(volumes5m, 14);
    const vwapArr = (0, indicators_1.calculateVWAP)(candles5m);
    const macd = (0, indicators_1.calculateMACD)(closes5m, 12, 26, 9);
    const lastIdx = closes5m.length - 1;
    const ema9 = ema9Arr[lastIdx] || currentPrice;
    const ema21 = ema21Arr[lastIdx] || currentPrice;
    const rsi5m = rsiArr[lastIdx] || 50;
    const atr5m = atrArr[lastIdx] || (currentPrice * 0.015);
    const volumeZ5m = zArr[lastIdx] || 0;
    const vwap5m = vwapArr[lastIdx] || currentPrice;
    const macdHist = macd.histogram[lastIdx] || 0;
    const prevHist = macd.histogram[lastIdx - 1] || 0;
    const swingLow = (0, indicators_1.findSwingLow)(candles5m, 10);
    const swingHigh = (0, indicators_1.findSwingHigh)(candles5m, 10);
    const ind = {
        rsi5m: parseFloat(rsi5m.toFixed(1)),
        atr5m: parseFloat(atr5m.toFixed(5)),
        volumeZ5m: parseFloat(volumeZ5m.toFixed(2)),
        vwap5m: parseFloat(vwap5m.toFixed(4)),
        ema9_5m: parseFloat(ema9.toFixed(4)),
        ema21_5m: parseFloat(ema21.toFixed(4)),
        regime15m: regime,
        adx15m: parseFloat(adx15m.toFixed(1)),
        chop15m: parseFloat(chop15m.toFixed(1)),
        swingLow,
        swingHigh,
        currentPrice,
    };
    // ─── HIGH CONVICTION PULLBACK: LONG ──────────────────────────────────────────
    // 15m is TRENDING_BULL, 5m price pulled back into EMA21/VWAP (RSI 38-50), volume expands
    if (regime === 'TRENDING_BULL' &&
        rsi5m <= config_1.SIGNAL.RSI_PULLBACK_LONG &&
        rsi5m >= 34 &&
        currentPrice >= (ema21 - atr5m * 0.5) &&
        macdHist > prevHist &&
        volumeZ5m >= 0.8) {
        // Dynamic Triple Barrier Geometry
        const rawStopDist = Math.max(currentPrice - swingLow, atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const stopLossPrice = currentPrice - rawStopDist;
        const takeProfitPrice = currentPrice + (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((takeProfitPrice - currentPrice) / (currentPrice - stopLossPrice)).toFixed(2));
        return {
            action: 'LONG',
            regime,
            stopLossPrice,
            takeProfitPrice,
            plannedRR,
            atr: atr5m,
            indicators: ind,
            reason: `15M_BULL_PULLBACK: 15m=BULL, 5m RSI=${rsi5m.toFixed(1)} pulled into EMA21/VWAP, planned RR=${plannedRR}:1`,
        };
    }
    // ─── HIGH CONVICTION PULLBACK: SHORT ─────────────────────────────────────────
    // 15m is TRENDING_BEAR, 5m price rallied into EMA21/VWAP (RSI 50-62), volume expands
    if (regime === 'TRENDING_BEAR' &&
        rsi5m >= config_1.SIGNAL.RSI_PULLBACK_SHORT &&
        rsi5m <= 66 &&
        currentPrice <= (ema21 + atr5m * 0.5) &&
        macdHist < prevHist &&
        volumeZ5m >= 0.8) {
        const rawStopDist = Math.max(swingHigh - currentPrice, atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const stopLossPrice = currentPrice + rawStopDist;
        const takeProfitPrice = currentPrice - (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((currentPrice - takeProfitPrice) / (stopLossPrice - currentPrice)).toFixed(2));
        return {
            action: 'SHORT',
            regime,
            stopLossPrice,
            takeProfitPrice,
            plannedRR,
            atr: atr5m,
            indicators: ind,
            reason: `15M_BEAR_PULLBACK: 15m=BEAR, 5m RSI=${rsi5m.toFixed(1)} rallied into EMA21/VWAP, planned RR=${plannedRR}:1`,
        };
    }
    return mkWait(`5m bar waiting for pullback. 15m=${regime}, 5m RSI=${rsi5m.toFixed(1)}, VolZ=${volumeZ5m.toFixed(2)}, ADX=${adx15m.toFixed(1)}`, currentPrice, regime, ind);
}
function mkWait(reason, currentPrice, regime, ind) {
    return {
        action: 'WAIT',
        regime,
        stopLossPrice: 0,
        takeProfitPrice: 0,
        plannedRR: 0,
        atr: 0,
        indicators: ind || {
            rsi5m: 50,
            atr5m: 0,
            volumeZ5m: 0,
            vwap5m: currentPrice,
            ema9_5m: currentPrice,
            ema21_5m: currentPrice,
            regime15m: regime,
            adx15m: 20,
            chop15m: 50,
            swingLow: 0,
            swingHigh: 0,
            currentPrice,
        },
        reason,
    };
}
//# sourceMappingURL=signal-detector.js.map