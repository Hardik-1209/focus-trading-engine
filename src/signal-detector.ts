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
import { SIGNAL, RISK } from './config';
import type { Candle, MarketRegime } from './indicators';
import {
  computeRegime15m,
  calculateEMA,
  calculateRSI,
  calculateATR,
  calculateVolumeZScores,
  calculateVWAP,
  calculateMACD,
  findSwingLow,
  findSwingHigh,
} from './indicators';

export type SignalAction = 'LONG' | 'SHORT' | 'WAIT';

export interface DetectedSignal {
  action:           SignalAction;
  regime:           MarketRegime;
  stopLossPrice:    number;
  takeProfitPrice:  number;
  plannedRR:        number;
  atr:              number;
  indicators: {
    rsi5m:          number;
    atr5m:          number;
    volumeZ5m:      number;
    vwap5m:         number;
    ema9_5m:        number;
    ema21_5m:       number;
    regime15m:      MarketRegime;
    adx15m:         number;
    chop15m:        number;
    swingLow:       number;
    swingHigh:      number;
    currentPrice:   number;
  };
  reason: string;
}

export function detectSignal(
  candles5m: Candle[],
  currentPrice: number,
  candles15m: Candle[] = []
): DetectedSignal {
  if (candles5m.length < 20 || candles15m.length < 20) {
    return mkWait('Insufficient historical candles (need >=20 x 5m and 15m)', currentPrice, 'RANGING');
  }

  // 1. 15-Minute Regime Classification
  const { regime, adx15m, chop15m } = computeRegime15m(candles15m);

  if (regime === 'VOLATILE_CHOP') {
    return mkWait(`Market in volatile chop on 15m (CHOP=${chop15m.toFixed(1)}>58, ADX=${adx15m.toFixed(1)}). Capital protected.`, currentPrice, regime);
  }

  if (regime === 'RANGING') {
    return mkWait(`Market in horizontal ranging state on 15m. Awaiting directional breakout.`, currentPrice, regime);
  }

  // 2. 5-Minute Technical Indicators
  const closes5m  = candles5m.map(c => c.close);
  const volumes5m = candles5m.map(c => c.volume);

  const ema9Arr   = calculateEMA(closes5m, 9);
  const ema21Arr  = calculateEMA(closes5m, 21);
  const rsiArr    = calculateRSI(closes5m, 14);
  const atrArr    = calculateATR(candles5m, 14);
  const zArr      = calculateVolumeZScores(volumes5m, 14);
  const vwapArr   = calculateVWAP(candles5m);
  const macd      = calculateMACD(closes5m, 12, 26, 9);

  const lastIdx    = closes5m.length - 1;
  const ema9       = ema9Arr[lastIdx]   || currentPrice;
  const ema21      = ema21Arr[lastIdx]  || currentPrice;
  const rsi5m      = rsiArr[lastIdx]    || 50;
  const atr5m      = atrArr[lastIdx]    || (currentPrice * 0.015);
  const volumeZ5m  = zArr[lastIdx]      || 0;
  const vwap5m     = vwapArr[lastIdx]   || currentPrice;
  const macdHist   = macd.histogram[lastIdx] || 0;
  const prevHist   = macd.histogram[lastIdx - 1] || 0;

  const swingLow   = findSwingLow(candles5m, 10);
  const swingHigh  = findSwingHigh(candles5m, 10);

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
  if (
    regime === 'TRENDING_BULL' &&
    rsi5m <= SIGNAL.RSI_PULLBACK_LONG &&
    rsi5m >= 34 &&
    currentPrice >= (ema21 - atr5m * 0.5) &&
    macdHist > prevHist &&
    volumeZ5m >= 0.8
  ) {
    // Dynamic Triple Barrier Geometry
    const rawStopDist = Math.max(currentPrice - swingLow, atr5m * RISK.STOP_LOSS_ATR_MULT);
    const stopLossPrice = currentPrice - rawStopDist;
    const takeProfitPrice = currentPrice + (atr5m * RISK.TAKE_PROFIT_ATR_MULT);
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
  if (
    regime === 'TRENDING_BEAR' &&
    rsi5m >= SIGNAL.RSI_PULLBACK_SHORT &&
    rsi5m <= 66 &&
    currentPrice <= (ema21 + atr5m * 0.5) &&
    macdHist < prevHist &&
    volumeZ5m >= 0.8
  ) {
    const rawStopDist = Math.max(swingHigh - currentPrice, atr5m * RISK.STOP_LOSS_ATR_MULT);
    const stopLossPrice = currentPrice + rawStopDist;
    const takeProfitPrice = currentPrice - (atr5m * RISK.TAKE_PROFIT_ATR_MULT);
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

  return mkWait(
    `5m bar waiting for pullback. 15m=${regime}, 5m RSI=${rsi5m.toFixed(1)}, VolZ=${volumeZ5m.toFixed(2)}, ADX=${adx15m.toFixed(1)}`,
    currentPrice,
    regime,
    ind
  );
}

function mkWait(reason: string, currentPrice: number, regime: MarketRegime, ind?: any): DetectedSignal {
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
