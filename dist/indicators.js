"use strict";
/**
 * indicators.ts (v3.0)
 * Quantitative Indicator & Market Structure Engine
 *
 * Computes:
 * - 15m Structural Regime (EMA 21/50, ADX 14, CHOP 14, VWAP)
 * - 5m Trigger Dynamics (Pullbacks, Rejection wicks, RSI, Volume Z-Score, ATR)
 * - Swing High / Low structural support & resistance detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEMA = calculateEMA;
exports.calculateRSI = calculateRSI;
exports.calculateMACD = calculateMACD;
exports.calculateADX = calculateADX;
exports.calculateATR = calculateATR;
exports.calculateVolumeZScores = calculateVolumeZScores;
exports.calculateCHOP = calculateCHOP;
exports.calculateVWAP = calculateVWAP;
exports.findSwingLow = findSwingLow;
exports.findSwingHigh = findSwingHigh;
exports.computeRegime15m = computeRegime15m;
function calculateEMA(prices, period) {
    const ema = new Array(prices.length).fill(NaN);
    if (prices.length < period || period <= 0)
        return ema;
    let sum = 0;
    for (let i = 0; i < period; i++)
        sum += prices[i];
    ema[period - 1] = sum / period;
    const multiplier = 2 / (period + 1);
    for (let i = period; i < prices.length; i++) {
        ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema;
}
function calculateRSI(closes, period = 14) {
    const rsi = new Array(closes.length).fill(NaN);
    if (closes.length < period + 1)
        return rsi;
    const gains = new Array(closes.length).fill(0);
    const losses = new Array(closes.length).fill(0);
    for (let i = 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        gains[i] = diff > 0 ? diff : 0;
        losses[i] = diff < 0 ? Math.abs(diff) : 0;
    }
    let avgGain = gains.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
    let avgLoss = losses.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
    const calcRSI = (ag, al) => al === 0 ? 100 : 100 - (100 / (1 + ag / al));
    rsi[period] = calcRSI(avgGain, avgLoss);
    for (let i = period + 1; i < closes.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        rsi[i] = calcRSI(avgGain, avgLoss);
    }
    return rsi;
}
function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
    const len = closes.length;
    const empty = () => new Array(len).fill(NaN);
    const emaFast = calculateEMA(closes, fast);
    const emaSlow = calculateEMA(closes, slow);
    const macdLine = empty();
    for (let i = slow - 1; i < len; i++) {
        if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i]))
            macdLine[i] = emaFast[i] - emaSlow[i];
    }
    const validMacd = [];
    const validIdx = [];
    for (let i = 0; i < len; i++) {
        if (!isNaN(macdLine[i])) {
            validMacd.push(macdLine[i]);
            validIdx.push(i);
        }
    }
    const signalLine = empty();
    const histogram = empty();
    if (validMacd.length >= signal) {
        const sigEMA = calculateEMA(validMacd, signal);
        for (let j = signal - 1; j < validMacd.length; j++) {
            const idx = validIdx[j];
            signalLine[idx] = sigEMA[j];
            histogram[idx] = macdLine[idx] - sigEMA[j];
        }
    }
    return { macdLine, signalLine, histogram };
}
function calculateADX(candles, period = 14) {
    const adxValues = new Array(candles.length).fill(NaN);
    if (candles.length < 2 * period || period <= 0)
        return adxValues;
    const tr = new Array(candles.length).fill(0);
    const dmP = new Array(candles.length).fill(0);
    const dmM = new Array(candles.length).fill(0);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < candles.length; i++) {
        const { high: h, low: l } = candles[i];
        const prevClose = candles[i - 1].close;
        tr[i] = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
        const up = h - candles[i - 1].high;
        const dn = candles[i - 1].low - l;
        dmP[i] = up > dn && up > 0 ? up : 0;
        dmM[i] = dn > up && dn > 0 ? dn : 0;
    }
    let sTR = tr.slice(1, period + 1).reduce((s, v) => s + v, 0);
    let sDMP = dmP.slice(1, period + 1).reduce((s, v) => s + v, 0);
    let sDMM = dmM.slice(1, period + 1).reduce((s, v) => s + v, 0);
    const dx = new Array(candles.length).fill(NaN);
    const calcDX = (p, m) => {
        const denom = p + m;
        return denom === 0 ? 0 : (Math.abs(p - m) / denom) * 100;
    };
    const diP0 = (sDMP / sTR) * 100;
    const diM0 = (sDMM / sTR) * 100;
    dx[period] = calcDX(diP0, diM0);
    for (let i = period + 1; i < candles.length; i++) {
        sTR = sTR - sTR / period + tr[i];
        sDMP = sDMP - sDMP / period + dmP[i];
        sDMM = sDMM - sDMM / period + dmM[i];
        const diP = (sDMP / sTR) * 100;
        const diM = (sDMM / sTR) * 100;
        dx[i] = calcDX(diP, diM);
    }
    let sumDX = 0;
    let dxCount = 0;
    const startADX = 2 * period - 1;
    for (let i = period; i <= startADX; i++) {
        if (!isNaN(dx[i])) {
            sumDX += dx[i];
            dxCount++;
        }
    }
    if (dxCount === period) {
        adxValues[startADX] = sumDX / period;
        for (let i = startADX + 1; i < candles.length; i++) {
            adxValues[i] = (adxValues[i - 1] * (period - 1) + dx[i]) / period;
        }
    }
    return adxValues;
}
function calculateATR(candles, period = 14) {
    const atr = new Array(candles.length).fill(NaN);
    if (candles.length < period + 1)
        return atr;
    const tr = new Array(candles.length).fill(0);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < candles.length; i++) {
        const { high: h, low: l } = candles[i];
        const prevC = candles[i - 1].close;
        tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    }
    let sum = 0;
    for (let i = 1; i <= period; i++)
        sum += tr[i];
    atr[period] = sum / period;
    for (let i = period + 1; i < candles.length; i++) {
        atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
    }
    return atr;
}
function calculateVolumeZScores(volumes, period = 14) {
    const z = new Array(volumes.length).fill(0);
    if (volumes.length < period)
        return z;
    for (let i = period - 1; i < volumes.length; i++) {
        const window = volumes.slice(i - period + 1, i + 1);
        const mean = window.reduce((s, v) => s + v, 0) / period;
        const variance = window.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        z[i] = stdDev === 0 ? 0 : (volumes[i] - mean) / stdDev;
    }
    return z;
}
/**
 * Choppiness Index (CHOP)
 * Range: 0 to 100. > 58 = Choppy / Sideways, < 42 = Strong Trend
 */
function calculateCHOP(candles, period = 14) {
    const chop = new Array(candles.length).fill(NaN);
    if (candles.length < period + 1)
        return chop;
    const tr = new Array(candles.length).fill(0);
    tr[0] = candles[0].high - candles[0].low;
    for (let i = 1; i < candles.length; i++) {
        const { high: h, low: l } = candles[i];
        const prevC = candles[i - 1].close;
        tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    }
    const log10n = Math.log10(period);
    for (let i = period; i < candles.length; i++) {
        let sumTR = 0;
        let maxHigh = -Infinity;
        let minLow = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            sumTR += tr[j];
            if (candles[j].high > maxHigh)
                maxHigh = candles[j].high;
            if (candles[j].low < minLow)
                minLow = candles[j].low;
        }
        const range = maxHigh - minLow;
        if (range <= 0 || sumTR <= 0) {
            chop[i] = 50;
        }
        else {
            const val = 100 * (Math.log10(sumTR / range) / log10n);
            chop[i] = Math.min(100, Math.max(0, val));
        }
    }
    return chop;
}
/** Volume-Weighted Average Price (VWAP) */
function calculateVWAP(candles) {
    const vwap = new Array(candles.length).fill(NaN);
    let cumVol = 0;
    let cumTypicalVol = 0;
    for (let i = 0; i < candles.length; i++) {
        const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
        const vol = candles[i].volume > 0 ? candles[i].volume : 1;
        cumTypicalVol += typicalPrice * vol;
        cumVol += vol;
        vwap[i] = cumVol > 0 ? cumTypicalVol / cumVol : candles[i].close;
    }
    return vwap;
}
/** Structural Swing Levels (Support & Resistance) */
function findSwingLow(candles, lookback = 10) {
    if (candles.length === 0)
        return 0;
    const slice = candles.slice(-lookback);
    let minLow = Infinity;
    for (const c of slice) {
        if (c.low < minLow)
            minLow = c.low;
    }
    return minLow;
}
function findSwingHigh(candles, lookback = 10) {
    if (candles.length === 0)
        return 0;
    const slice = candles.slice(-lookback);
    let maxHigh = -Infinity;
    for (const c of slice) {
        if (c.high > maxHigh)
            maxHigh = c.high;
    }
    return maxHigh;
}
function computeRegime15m(candles15m) {
    if (candles15m.length < 20) {
        return {
            regime: 'RANGING',
            ema21: 0,
            ema50: 0,
            adx15m: 20,
            chop15m: 50,
            vwap15m: 0,
        };
    }
    const closes = candles15m.map(c => c.close);
    const ema21Arr = calculateEMA(closes, 21);
    const ema50Arr = calculateEMA(closes, 50);
    const adxArr = calculateADX(candles15m, 14);
    const chopArr = calculateCHOP(candles15m, 14);
    const vwapArr = calculateVWAP(candles15m);
    const last = closes.length - 1;
    const price = closes[last];
    const ema21 = ema21Arr[last] || price;
    const ema50 = ema50Arr[last] || price;
    const adx15m = adxArr[last] || 20;
    const chop15m = !isNaN(chopArr[last]) ? chopArr[last] : 50;
    const vwap15m = vwapArr[last] || price;
    // High Volatility Chop
    if (chop15m > 58 || adx15m < 20) {
        return { regime: 'VOLATILE_CHOP', ema21, ema50, adx15m, chop15m, vwap15m };
    }
    // Bullish Trend
    if (ema21 > ema50 && price >= ema21 && price >= vwap15m && adx15m >= 22) {
        return { regime: 'TRENDING_BULL', ema21, ema50, adx15m, chop15m, vwap15m };
    }
    // Bearish Trend
    if (ema21 < ema50 && price <= ema21 && price <= vwap15m && adx15m >= 22) {
        return { regime: 'TRENDING_BEAR', ema21, ema50, adx15m, chop15m, vwap15m };
    }
    return { regime: 'RANGING', ema21, ema50, adx15m, chop15m, vwap15m };
}
//# sourceMappingURL=indicators.js.map