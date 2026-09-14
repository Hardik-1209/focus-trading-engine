import { detectSignal } from '../src/signal-detector';
import type { Candle } from '../src/indicators';

function run() {
  const baseTime = Date.now();
  // Oscillating pattern with mild uptrend: RSI ~50, EMA9 > EMA21
  const closes = [
    10.0, 10.05, 9.98, 10.02, 10.08, 10.04, 10.10, 10.06, 10.12, 10.08,
    10.15, 10.11, 10.18, 10.14, 10.20, 10.16, 10.22, 10.19, 10.25, 10.22,
    10.28, 10.25, 10.30, 10.27, 10.32, 10.29, 10.35, 10.31, 10.33, 10.32
  ];
  const c5m: Candle[] = closes.map((c, i) => ({
    timestamp: baseTime - (closes.length - i) * 300000,
    open: c - 0.02,
    high: c + 0.04,
    low: c - 0.03,
    close: c,
    volume: 30000 + (i % 3) * 5000,
  }));

  const c15m: Candle[] = closes.slice(0, 25).map((c, i) => ({
    timestamp: baseTime - (25 - i) * 900000,
    open: c - 0.04,
    high: c + 0.08,
    low: c - 0.06,
    close: c,
    volume: 80000,
  }));

  const currentPrice = c5m[c5m.length - 1].close;

  console.log('--- Test without downtrend (change24h = +2.0%) ---');
  const normalSig = detectSignal(c5m, currentPrice, c15m, 2.0);
  console.log('Normal signal:', normalSig.action, '|', normalSig.reason, '| 5m RSI:', normalSig.indicators.rsi5m);

  console.log('--- Test with severe downtrend (change24h = -40.0%) ---');
  const downtrendSig = detectSignal(c5m, currentPrice, c15m, -40.0);
  console.log('Downtrend signal:', downtrendSig.action, '|', downtrendSig.reason);

  if (normalSig.action === 'LONG' && downtrendSig.action === 'WAIT' && downtrendSig.reason.includes('MACRO DOWNTREND GATE')) {
    console.log('✅ TEST PASSED: Normal setup produces LONG, but -40% 24h change is intercepted by MACRO DOWNTREND GATE!');
  }
}

run();
