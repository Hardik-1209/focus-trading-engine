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
function detectSignal(candles5m, currentPrice, candles15m = [], change24h = 0) {
    if (candles5m.length < 20 || candles15m.length < 20) {
        return mkWait('Insufficient historical candles (need >=20 x 5m and 15m)', currentPrice, 'RANGING');
    }
    // 1. 15-Minute Regime Classification
    const { regime, adx15m, chop15m } = (0, indicators_1.computeRegime15m)(candles15m);
    // Only veto if in extreme chaotic chop with zero direction
    if (chop15m > config_1.SIGNAL.CHOP_MAX && adx15m < 14) {
        return mkWait(`Extreme chaotic chop on 15m (CHOP=${chop15m.toFixed(1)}>${config_1.SIGNAL.CHOP_MAX}, ADX=${adx15m.toFixed(1)}<14). Capital protected.`, currentPrice, regime);
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
    // Helper to enforce Macro Trend Gates before returning any actionable signal
    function buildLongSignal(stopLossPrice, takeProfitPrice, plannedRR, reason) {
        if (plannedRR < 1.4) {
            return mkWait(`Planned R:R too low (${plannedRR}:1 < 1.4:1)`, currentPrice, regime, ind);
        }
        // FALLING KNIFE / MACRO DOWNTREND VETO
        if (change24h < -4.0) {
            return mkWait(`MACRO DOWNTREND GATE: 24h change is ${change24h.toFixed(1)}% (< -4.0%). LONGs strictly prohibited on falling knives.`, currentPrice, regime, ind);
        }
        return {
            action: 'LONG',
            regime,
            stopLossPrice,
            takeProfitPrice,
            plannedRR,
            atr: atr5m,
            indicators: ind,
            reason,
        };
    }
    function buildShortSignal(stopLossPrice, takeProfitPrice, plannedRR, reason) {
        if (plannedRR < 1.4) {
            return mkWait(`Planned R:R too low (${plannedRR}:1 < 1.4:1)`, currentPrice, regime, ind);
        }
        // PARABOLIC SQUEEZE VETO
        if (change24h > 25.0) {
            return mkWait(`PARABOLIC PUMP GATE: 24h change is +${change24h.toFixed(1)}% (> +25.0%). SHORTs strictly prohibited on runaway runners.`, currentPrice, regime, ind);
        }
        return {
            action: 'SHORT',
            regime,
            stopLossPrice,
            takeProfitPrice,
            plannedRR,
            atr: atr5m,
            indicators: ind,
            reason,
        };
    }
    // ─── SETUP 1: 15M/5M TREND PULLBACK CONTINUATION ────────────────────────────
    // Bullish trend: 15m BULL or 5m EMA9 > EMA21, price pulled into EMA21/VWAP (RSI 36-54)
    if ((regime === 'TRENDING_BULL' || (ema9 >= ema21 && currentPrice >= (vwap5m - atr5m * 0.4))) &&
        rsi5m <= config_1.SIGNAL.RSI_PULLBACK_LONG &&
        rsi5m >= 34 &&
        currentPrice >= (ema21 - atr5m * 0.8) &&
        (macdHist >= prevHist || macdHist > 0)) {
        const rawStopDist = Math.max(currentPrice - swingLow, atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const stopLossPrice = currentPrice - rawStopDist;
        const takeProfitPrice = currentPrice + (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((takeProfitPrice - currentPrice) / Math.max(0.0001, currentPrice - stopLossPrice)).toFixed(2));
        const sig = buildLongSignal(stopLossPrice, takeProfitPrice, plannedRR, `TREND_PULLBACK_LONG: 15m=${regime}, 5m RSI=${rsi5m.toFixed(1)} pulled to EMA21/VWAP, planned RR=${plannedRR}:1`);
        if (sig.action !== 'WAIT')
            return sig;
    }
    // Bearish trend: 15m BEAR or 5m EMA9 < EMA21, price rallied into EMA21/VWAP (RSI 46-64)
    if ((regime === 'TRENDING_BEAR' || (ema9 <= ema21 && currentPrice <= (vwap5m + atr5m * 0.4))) &&
        rsi5m >= config_1.SIGNAL.RSI_PULLBACK_SHORT &&
        rsi5m <= 66 &&
        currentPrice <= (ema21 + atr5m * 0.8) &&
        (macdHist <= prevHist || macdHist < 0)) {
        const rawStopDist = Math.max(swingHigh - currentPrice, atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const stopLossPrice = currentPrice + rawStopDist;
        const takeProfitPrice = currentPrice - (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((currentPrice - takeProfitPrice) / Math.max(0.0001, stopLossPrice - currentPrice)).toFixed(2));
        const sig = buildShortSignal(stopLossPrice, takeProfitPrice, plannedRR, `TREND_PULLBACK_SHORT: 15m=${regime}, 5m RSI=${rsi5m.toFixed(1)} rallied to EMA21/VWAP, planned RR=${plannedRR}:1`);
        if (sig.action !== 'WAIT')
            return sig;
    }
    // ─── SETUP 2: RANGE-BOUND MEAN REVERSION (When 15m is RANGING) ──────────────
    if (regime === 'RANGING' || chop15m >= 50) {
        // Range Support Buy: Price near swingLow, RSI oversold <= 38, momentum bottoming
        // If coin has negative daily momentum (< -1.5%), range support usually fails
        if (change24h >= -1.5 &&
            rsi5m <= config_1.SIGNAL.RSI_RANGE_BUY &&
            currentPrice <= (ema21 - atr5m * 0.3) &&
            macdHist > prevHist) {
            const stopLossPrice = Math.min(swingLow - (atr5m * 0.4), currentPrice - (atr5m * config_1.RISK.STOP_LOSS_ATR_MULT));
            const takeProfitPrice = currentPrice + (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
            const plannedRR = parseFloat(((takeProfitPrice - currentPrice) / Math.max(0.0001, currentPrice - stopLossPrice)).toFixed(2));
            const sig = buildLongSignal(stopLossPrice, takeProfitPrice, plannedRR, `RANGE_SUPPORT_LONG: Range mean-reversion, RSI=${rsi5m.toFixed(1)} at support, planned RR=${plannedRR}:1`);
            if (sig.action !== 'WAIT')
                return sig;
        }
        // Range Resistance Short: Price near swingHigh, RSI overbought >= 62, momentum topping
        // If coin has strong daily momentum (> 15%), range resistance usually breaks out upward
        if (change24h <= 15.0 &&
            rsi5m >= config_1.SIGNAL.RSI_RANGE_SELL &&
            currentPrice >= (ema21 + atr5m * 0.3) &&
            macdHist < prevHist) {
            const stopLossPrice = Math.max(swingHigh + (atr5m * 0.4), currentPrice + (atr5m * config_1.RISK.STOP_LOSS_ATR_MULT));
            const takeProfitPrice = currentPrice - (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
            const plannedRR = parseFloat(((currentPrice - takeProfitPrice) / Math.max(0.0001, stopLossPrice - currentPrice)).toFixed(2));
            const sig = buildShortSignal(stopLossPrice, takeProfitPrice, plannedRR, `RANGE_RESISTANCE_SHORT: Range mean-reversion, RSI=${rsi5m.toFixed(1)} at resistance, planned RR=${plannedRR}:1`);
            if (sig.action !== 'WAIT')
                return sig;
        }
    }
    // ─── SETUP 3: 5M MICROSTRUCTURE MOMENTUM EXPANSION ─────────────────────────
    // Bullish expansion: EMA9 > EMA21, price above VWAP, RSI 48-68, MACD positive expansion
    if (ema9 > ema21 &&
        currentPrice > vwap5m &&
        rsi5m >= 48 &&
        rsi5m <= config_1.SIGNAL.RSI_OVERBOUGHT &&
        macdHist > 0 &&
        macdHist >= prevHist &&
        volumeZ5m >= config_1.SIGNAL.VOLUME_ZSCORE_MIN) {
        const stopLossPrice = currentPrice - (atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const takeProfitPrice = currentPrice + (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((takeProfitPrice - currentPrice) / Math.max(0.0001, currentPrice - stopLossPrice)).toFixed(2));
        const sig = buildLongSignal(stopLossPrice, takeProfitPrice, plannedRR, `MOMENTUM_BREAKOUT_LONG: 5m EMA9>21 + VWAP reclaim + VolZ=${volumeZ5m.toFixed(2)}, planned RR=${plannedRR}:1`);
        if (sig.action !== 'WAIT')
            return sig;
    }
    // Bearish expansion: EMA9 < EMA21, price below VWAP, RSI 32-52, MACD negative expansion
    if (ema9 < ema21 &&
        currentPrice < vwap5m &&
        rsi5m <= 52 &&
        rsi5m >= config_1.SIGNAL.RSI_OVERSOLD &&
        macdHist < 0 &&
        macdHist <= prevHist &&
        volumeZ5m >= config_1.SIGNAL.VOLUME_ZSCORE_MIN) {
        const stopLossPrice = currentPrice + (atr5m * config_1.RISK.STOP_LOSS_ATR_MULT);
        const takeProfitPrice = currentPrice - (atr5m * config_1.RISK.TAKE_PROFIT_ATR_MULT);
        const plannedRR = parseFloat(((currentPrice - takeProfitPrice) / Math.max(0.0001, stopLossPrice - currentPrice)).toFixed(2));
        const sig = buildShortSignal(stopLossPrice, takeProfitPrice, plannedRR, `MOMENTUM_BREAKOUT_SHORT: 5m EMA9<21 + VWAP rejection + VolZ=${volumeZ5m.toFixed(2)}, planned RR=${plannedRR}:1`);
        if (sig.action !== 'WAIT')
            return sig;
    }
    return mkWait(`Awaiting setup trigger: 15m=${regime}, 5m RSI=${rsi5m.toFixed(1)}, VolZ=${volumeZ5m.toFixed(2)}, ADX=${adx15m.toFixed(1)}`, currentPrice, regime, ind);
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