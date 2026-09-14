import { evaluateRiskVerdictWithGemini } from '../src/gemini-client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Testing evaluateRiskVerdictWithGemini with proper candle block...');
  const baseTime = Date.now();
  const c5m = Array.from({ length: 20 }, (_, i) => ({
    timestamp: baseTime - (20 - i) * 300000,
    open: 130 + i * 0.1,
    high: 130.5 + i * 0.1,
    low: 129.8 + i * 0.1,
    close: 130.2 + i * 0.1,
    volume: 5000 + i * 100
  }));
  const c15m = Array.from({ length: 20 }, (_, i) => ({
    timestamp: baseTime - (20 - i) * 900000,
    open: 128 + i * 0.2,
    high: 129 + i * 0.2,
    low: 127.5 + i * 0.2,
    close: 128.5 + i * 0.2,
    volume: 15000 + i * 200
  }));

  try {
    const res = await evaluateRiskVerdictWithGemini({
      symbol: 'SOLUSDT',
      action: 'LONG',
      plannedRR: 1.8,
      stopLossPrice: 129.0,
      takeProfitPrice: 135.0,
      fundingRate: 0.0001,
      walletBalance: 10.0,
      candles5m: c5m,
      candles15m: c15m,
      technicalBlock: {
        rsi5m: 48,
        atr5m: 1.1,
        volumeZ5m: 0.8,
        vwap5m: 131.5,
        regime15m: 'TRENDING_BULL',
        adx15m: 24,
        chop15m: 42,
        currentPrice: 132.2,
        swingLow: 130.0,
        swingHigh: 133.0
      }
    });
    console.log('Gemini 3.6 Flash Verdict Result:', res);
  } catch (err: any) {
    console.error('Test error:', err.message);
  }
}
run();
