import { evaluateRiskVerdictWithGemini } from '../src/gemini-client';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log('Testing evaluateRiskVerdictWithGemini on dumping asset (-35%)...');
  const baseTime = Date.now();
  const c5m = Array.from({ length: 20 }, (_, i) => ({
    timestamp: baseTime - (20 - i) * 300000,
    open: 0.40,
    high: 0.41,
    low: 0.39,
    close: 0.40,
    volume: 50000
  }));
  const c15m = Array.from({ length: 20 }, (_, i) => ({
    timestamp: baseTime - (20 - i) * 900000,
    open: 0.60,
    high: 0.61,
    low: 0.39,
    close: 0.40,
    volume: 150000
  }));

  const verdict = await evaluateRiskVerdictWithGemini({
    symbol: 'LSKUSDT',
    action: 'LONG',
    plannedRR: 1.8,
    stopLossPrice: 0.38,
    takeProfitPrice: 0.44,
    change24h: -35.0,
    fundingRate: -0.0002,
    candles5m: c5m,
    candles15m: c15m,
    technicalBlock: {
      rsi5m: 36,
      atr5m: 0.015,
      volumeZ5m: 0.8,
      vwap5m: 0.41,
      regime15m: 'TRENDING_BEAR',
      adx15m: 45,
      chop15m: 35,
      currentPrice: 0.40,
      swingLow: 0.39,
      swingHigh: 0.42
    }
  });

  console.log('\nResult for LONG on -35% dumper:');
  console.log('Verdict:', verdict.verdict);
  console.log('Decision:', verdict.decision);
  console.log('Disqualifiers:', verdict.disqualifiers);
  console.log('Reasoning:', verdict.reasoning);

  if (verdict.verdict === 'VETO' && verdict.decision === 'STAND_ASIDE') {
    console.log('\n✅ TEST PASSED: Gemini correctly rejected LONG on -35% dumper!');
  } else {
    console.error('\n❌ FAILED: Did not veto long!');
  }
}
run();
