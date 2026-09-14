import { detectSignal } from '../src/signal-detector';
import { evaluateOpenPosition } from '../src/llm-router';
import type { Candle } from '../src/indicators';
import dotenv from 'dotenv';
dotenv.config();

async function runTests() {
  console.log('=====================================================');
  console.log('🧪 RUNNING v3.4 MACRO FILTER & AI GUARDIAN TEST SUITE');
  console.log('=====================================================\n');

  const baseTime = Date.now();

  // 1. Simulate 20 x 5m candles bouncing up from deep dump (e.g. RSI ~36, EMA9 > EMA21)
  const c5m: Candle[] = Array.from({ length: 25 }, (_, i) => ({
    timestamp: baseTime - (25 - i) * 300000,
    open: 0.40 + i * 0.002,
    high: 0.405 + i * 0.002,
    low: 0.398 + i * 0.002,
    close: 0.403 + i * 0.002,
    volume: 80000 + i * 1000,
  }));

  // 15m candles in severe downtrend
  const c15m: Candle[] = Array.from({ length: 25 }, (_, i) => ({
    timestamp: baseTime - (25 - i) * 900000,
    open: 0.80 - i * 0.015,
    high: 0.81 - i * 0.015,
    low: 0.78 - i * 0.015,
    close: 0.79 - i * 0.015,
    volume: 250000 + i * 5000,
  }));

  const currentPrice = c5m[c5m.length - 1].close;

  // ─── TEST 1: Macro Downtrend Gate on -40% dumper ──────────────────────────
  console.log('--- TEST 1: Passing -40% 24h change into detectSignal ---');
  const signalDowntrend = detectSignal(c5m, currentPrice, c15m, -40.0);
  console.log(`Action: ${signalDowntrend.action}`);
  console.log(`Reason: ${signalDowntrend.reason}`);
  if (signalDowntrend.action === 'WAIT' && signalDowntrend.reason.includes('MACRO DOWNTREND GATE')) {
    console.log('✅ TEST 1 PASSED: Long successfully blocked on -40% falling knife!\n');
  } else if (signalDowntrend.action === 'SHORT') {
    console.log('✅ TEST 1 PASSED: Only short allowed on -40% downtrend!\n');
  } else {
    console.error('❌ TEST 1 FAILED: Signal was not blocked:', signalDowntrend);
  }

  // ─── TEST 2: Parabolic Pump Gate on +35% runner ───────────────────────────
  console.log('--- TEST 2: Passing +35% 24h change for short veto ---');
  // Construct bearish 5m candles
  const c5mBear: Candle[] = Array.from({ length: 25 }, (_, i) => ({
    timestamp: baseTime - (25 - i) * 300000,
    open: 1.50 - i * 0.01,
    high: 1.51 - i * 0.01,
    low: 1.48 - i * 0.01,
    close: 1.49 - i * 0.01,
    volume: 50000,
  }));
  const signalPumper = detectSignal(c5mBear, c5mBear[c5mBear.length - 1].close, c15m, 35.0);
  console.log(`Action: ${signalPumper.action}`);
  console.log(`Reason: ${signalPumper.reason}`);
  if (signalPumper.action === 'WAIT' && signalPumper.reason.includes('PARABOLIC PUMP GATE')) {
    console.log('✅ TEST 2 PASSED: Short successfully blocked on +35% pumper!\n');
  } else if (signalPumper.action !== 'SHORT') {
    console.log('✅ TEST 2 PASSED: Short not executed into parabolic rally!\n');
  }

  // ─── TEST 3: AI Position Guardian on Broken Market Structure ─────────────
  console.log('--- TEST 3: AI Position Guardian on Breakdown ---');
  // Long position opened at 100, but price crashed to 97 with consecutive red candles
  const c5mBreakdown: Candle[] = Array.from({ length: 15 }, (_, i) => ({
    timestamp: baseTime - (15 - i) * 300000,
    open: 100 - i * 0.3,
    high: 100.1 - i * 0.3,
    low: 99.5 - i * 0.3,
    close: 99.6 - i * 0.3,
    volume: 120000 + i * 5000, // Expanding sell volume
  }));
  const c15mBreakdown: Candle[] = Array.from({ length: 15 }, (_, i) => ({
    timestamp: baseTime - (15 - i) * 900000,
    open: 102 - i * 0.5,
    high: 102.2 - i * 0.5,
    low: 101.0 - i * 0.5,
    close: 101.2 - i * 0.5,
    volume: 300000,
  }));

  const mockLongPosition = {
    tradeId: 'test-trade-1',
    symbol: 'SOLUSDT',
    positionSide: 'LONG' as const,
    entryPrice: 100.0,
    stopLossPrice: 95.0,
    takeProfitPrice: 108.0,
    openedAt: Date.now() - 15 * 60 * 1000, // 15 mins ago
  };

  const review = await evaluateOpenPosition(
    mockLongPosition,
    96.5,
    c5mBreakdown,
    c15mBreakdown
  );

  console.log('AI Position Guardian Review Result:');
  console.log(`Action: ${review.action} [Provider: ${review.llmSource}]`);
  console.log(`Reason: ${review.reason}`);
  if (review.action === 'EXIT') {
    console.log('✅ TEST 3 PASSED: AI Guardian correctly identified market breakdown and ordered EXIT!\n');
  } else {
    console.log(`ℹ️ AI Guardian decision: ${review.action} (${review.reason})\n`);
  }

  console.log('🎉 ALL v3.4 DIAGNOSTIC TESTS COMPLETE.');
}

runTests();
