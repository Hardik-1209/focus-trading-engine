import { evaluateOpenPositionWithGemini } from '../src/gemini-client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Testing evaluateOpenPositionWithGemini with gemini-3.5-flash-lite...');
  const baseTime = Date.now();
  const c5m = Array.from({ length: 15 }, (_, i) => ({
    timestamp: baseTime - (15 - i) * 300000,
    open: 0.05 + i * 0.0002,
    high: 0.0505 + i * 0.0002,
    low: 0.0498 + i * 0.0002,
    close: 0.0502 + i * 0.0002,
    volume: 100000
  }));
  const c15m = Array.from({ length: 10 }, (_, i) => ({
    timestamp: baseTime - (10 - i) * 900000,
    open: 0.049 + i * 0.0004,
    high: 0.051 + i * 0.0004,
    low: 0.0485 + i * 0.0004,
    close: 0.050 + i * 0.0004,
    volume: 300000
  }));

  const pos = {
    symbol: 'STEEMUSDT',
    positionSide: 'LONG' as const,
    entryPrice: 0.0500,
    stopLossPrice: 0.0490,
    takeProfitPrice: 0.0520,
    openedAt: Date.now() - 12 * 60000,
  };

  const res = await evaluateOpenPositionWithGemini(pos, 0.0504, c5m, c15m);
  console.log('AI Position Guardian Result:', res);
}
run();
