/**
 * indicators.ts
 * Quantitative indicator engine — EMA, RSI, MACD, ADX, ATR, Volume Z-Score, Choppiness Index (CHOP), VWAP, and MTF Trend.
 */

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MACDResult {
  macdLine:   number[];
  signalLine: number[];
  histogram:  number[];
}

export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = new Array(prices.length).fill(NaN);
  if (prices.length < period || period <= 0) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  ema[period - 1] = sum / period;
  const multiplier = 2 / (period + 1);
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  return ema;
}

export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  const gains: number[] = new Array(closes.length).fill(0);
  const losses: number[] = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains[i]  = diff > 0 ? diff : 0;
    losses[i] = diff < 0 ? Math.abs(diff) : 0;
  }
  let avgGain = gains.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
  let avgLoss = losses.slice(1, period + 1).reduce((s, v) => s + v, 0) / period;
  const calcRSI = (ag: number, al: number) => al === 0 ? 100 : 100 - (100 / (1 + ag / al));
  rsi[period] = calcRSI(avgGain, avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi[i] = calcRSI(avgGain, avgLoss);
  }
  return rsi;
}

export function calculateMACD(
  closes: number[], fast = 12, slow = 26, signal = 9
): MACDResult {
  const len = closes.length;
  const empty = () => new Array(len).fill(NaN);
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine = empty();
  for (let i = slow - 1; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) macdLine[i] = emaFast[i] - emaSlow[i];
  }
  const validMacd: number[] = [];
  const validIdx: number[] = [];
  for (let i = 0; i < len; i++) {
    if (!isNaN(macdLine[i])) { validMacd.push(macdLine[i]); validIdx.push(i); }
  }
  const signalLine = empty();
  const histogram  = empty();
  if (validMacd.length >= signal) {
    const sigEMA = calculateEMA(validMacd, signal);
    for (let j = signal - 1; j < validMacd.length; j++) {
      const idx = validIdx[j];
      signalLine[idx] = sigEMA[j];
      histogram[idx]  = macdLine[idx] - sigEMA[j];
    }
  }
  return { macdLine, signalLine, histogram };
}

export function calculateADX(candles: Candle[], period: number = 14): number[] {
  const adxValues: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < 2 * period || period <= 0) return adxValues;
  const tr: number[] = new Array(candles.length).fill(0);
  const dmP: number[] = new Array(candles.length).fill(0);
  const dmM: number[] = new Array(candles.length).fill(0);
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
  const dx: number[] = new Array(candles.length).fill(NaN);
  const calcDX = (p: number, m: number) => {
    const denom = p + m;
    return denom === 0 ? 0 : (Math.abs(p - m) / denom) * 100;
  };
  const diP0 = (sDMP / sTR) * 100;
  const diM0 = (sDMM / sTR) * 100;
  dx[period] = calcDX(diP0, diM0);
  for (let i = period + 1; i < candles.length; i++) {
    sTR  = sTR  - sTR  / period + tr[i];
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
    if (!isNaN(dx[i])) { sumDX += dx[i]; dxCount++; }
  }
  if (dxCount === period) {
    adxValues[startADX] = sumDX / period;
    for (let i = startADX + 1; i < candles.length; i++) {
      adxValues[i] = (adxValues[i - 1] * (period - 1) + dx[i]) / period;
    }
  }
  return adxValues;
}

export function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period + 1) return atr;
  const tr: number[] = new Array(candles.length).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < candles.length; i++) {
    const { high: h, low: l } = candles[i];
    const prevC = candles[i - 1].close;
    tr[i] = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  atr[period] = sum / period;
  for (let i = period + 1; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

export function calculateVolumeZScores(volumes: number[], period: number = 14): number[] {
  const z: number[] = new Array(volumes.length).fill(0);
  if (volumes.length < period) return z;
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
 * Range: 0 to 100
 * > 61.8 = Market is consolidating / choppy
 * < 38.2 = Market is trending strongly
 */
export function calculateCHOP(candles: Candle[], period: number = 14): number[] {
  const chop: number[] = new Array(candles.length).fill(NaN);
  if (candles.length < period + 1) return chop;

  const tr: number[] = new Array(candles.length).fill(0);
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
      if (candles[j].high > maxHigh) maxHigh = candles[j].high;
      if (candles[j].low < minLow) minLow = candles[j].low;
    }
    const range = maxHigh - minLow;
    if (range <= 0 || sumTR <= 0) {
      chop[i] = 50;
    } else {
      const val = 100 * (Math.log10(sumTR / range) / log10n);
      chop[i] = Math.min(100, Math.max(0, val));
    }
  }

  return chop;
}

/**
 * Volume-Weighted Average Price (VWAP)
 */
export function calculateVWAP(candles: Candle[]): number[] {
  const vwap: number[] = new Array(candles.length).fill(NaN);
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

export type HigherTimeframeTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export function computeMTFTrend(candles5m: Candle[]): {
  trend: HigherTimeframeTrend;
  emaFast: number;
  emaSlow: number;
  rsi5m: number;
} {
  if (candles5m.length < 20) {
    return { trend: 'NEUTRAL', emaFast: 0, emaSlow: 0, rsi5m: 50 };
  }
  const closes = candles5m.map(c => c.close);
  const emaFastArr = calculateEMA(closes, 9);
  const emaSlowArr = calculateEMA(closes, 21);
  const rsiArr = calculateRSI(closes, 14);

  const last = closes.length - 1;
  const currentPrice = closes[last];
  const emaFast = emaFastArr[last] || currentPrice;
  const emaSlow = emaSlowArr[last] || currentPrice;
  const rsi5m = rsiArr[last] || 50;

  if (emaFast > emaSlow && currentPrice >= emaFast && rsi5m >= 48) {
    return { trend: 'BULLISH', emaFast, emaSlow, rsi5m };
  } else if (emaFast < emaSlow && currentPrice <= emaFast && rsi5m <= 52) {
    return { trend: 'BEARISH', emaFast, emaSlow, rsi5m };
  }
  return { trend: 'NEUTRAL', emaFast, emaSlow, rsi5m };
}

/** Derive all signals and filters from candle arrays */
export function computeAllIndicators(candles1m: Candle[], candles5m: Candle[] = []) {
  const closes  = candles1m.map(c => c.close);
  const volumes = candles1m.map(c => c.volume);

  const emaArr   = calculateEMA(closes, 14);
  const ema50Arr = calculateEMA(closes, 50);
  const rsiArr   = calculateRSI(closes, 14);
  const macd     = calculateMACD(closes, 12, 26, 9);
  const adxArr   = calculateADX(candles1m, 14);
  const atrArr   = calculateATR(candles1m, 14);
  const zArr     = calculateVolumeZScores(volumes, 14);
  const chopArr  = calculateCHOP(candles1m, 14);
  const vwapArr  = calculateVWAP(candles1m);

  const last = candles1m.length - 1;
  const prev = last - 1;

  const latestClose    = closes[last];
  const latestEMA      = emaArr[last]   || latestClose;
  const latestEMA50    = ema50Arr[last] || latestEMA;
  const latestRSI      = rsiArr[last]   || 50;
  const latestADX      = adxArr[last]   || 0;
  const latestATR      = atrArr[last]   || (latestClose * 0.01);
  const latestZScore   = zArr[last]     || 0;
  const latestCHOP     = !isNaN(chopArr[last]) ? chopArr[last] : 45;
  const latestVWAP     = !isNaN(vwapArr[last]) ? vwapArr[last] : latestClose;
  const latestMACD     = macd.macdLine[last]   || 0;
  const latestSignal   = macd.signalLine[last] || 0;
  const latestHist     = macd.histogram[last]  || 0;
  const prevHist       = macd.histogram[prev]  || 0;

  const mtf = computeMTFTrend(candles5m);

  return {
    latestClose,
    latestEMA,
    latestEMA50,
    latestRSI,
    latestADX,
    latestATR,
    latestZScore,
    latestCHOP,
    latestVWAP,
    latestMACD,
    latestSignal,
    latestHist,
    prevHist,
    isChoppy:      latestCHOP > 62,
    aboveVWAP:     latestClose >= latestVWAP,
    emaCrossover:  latestClose >= latestEMA,
    ema50Bullish:  latestClose >= latestEMA50,
    rsiOversold:   latestRSI < 30,
    rsiOverbought: latestRSI > 70,
    macdBullish:   latestHist > 0 && latestHist > prevHist,
    macdBearish:   latestHist < 0 && latestHist < prevHist,
    macdCrossUp:   latestMACD > latestSignal,
    macdCrossDown: latestMACD < latestSignal,
    mtfTrend:      mtf.trend,
    mtfRsi:        mtf.rsi5m,
  };
}
