import { evaluateRiskVerdictWithGemini } from '../src/gemini-client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Testing evaluateRiskVerdictWithGemini...');
  try {
    const start = Date.now();
    const verdict = await evaluateRiskVerdictWithGemini({
      symbol: 'SOLUSDT',
      action: 'LONG',
      plannedRR: 1.8,
      stopLossPrice: 130.0,
      takeProfitPrice: 140.0,
      fundingRate: 0.0001,
      walletBalance: 10.0,
      technicalBlock: {
        rsi5m: 45,
        atr5m: 1.2,
        volumeZ5m: 1.1,
        vwap5m: 132.5,
        regime15m: 'TRENDING_BULL',
        adx15m: 25,
        chop15m: 40,
        currentPrice: 133.0,
        swingLow: 131.0,
        swingHigh: 135.0,
      },
      candles5m: [
        { timestamp: 1, open: 131, high: 132, low: 130.5, close: 131.5, volume: 1000 },
        { timestamp: 2, open: 131.5, high: 133, low: 131.2, close: 132.8, volume: 1500 },
        { timestamp: 3, open: 132.8, high: 133.5, low: 132.2, close: 133.0, volume: 1200 }
      ],
      candles15m: [
        { timestamp: 1, open: 129, high: 131, low: 128.5, close: 130.5, volume: 3000 },
        { timestamp: 2, open: 130.5, high: 133.5, low: 130.2, close: 133.0, volume: 3500 }
      ]
    });
    console.log(`Success in ${Date.now() - start}ms:`, verdict);
  } catch (err: any) {
    console.error('Gemini error:', err);
  }
}
run();
