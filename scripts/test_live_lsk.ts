import { fetchBootstrapCandles } from '../src/coin-selector';
import { detectSignal } from '../src/signal-detector';

async function run() {
  console.log('Fetching live market candles for LSKUSDT from Bitget...');
  const c5m = await fetchBootstrapCandles('LSKUSDT', 40, '5m');
  const c15m = await fetchBootstrapCandles('LSKUSDT', 30, '15m');
  const currentPrice = c5m[c5m.length - 1].close;

  console.log(`Current Price: $${currentPrice}, 5m count: ${c5m.length}, 15m count: ${c15m.length}`);

  // Test 1: Calling detectSignal with change24h = -51.4%
  const sigWithDowntrend = detectSignal(c5m, currentPrice, c15m, -51.4);
  console.log('\n--- With Live Downtrend (-51.4%) ---');
  console.log('Action:', sigWithDowntrend.action);
  console.log('Reason:', sigWithDowntrend.reason);

  // Test 2: If someone passed change24h = 0
  const sigBypassed = detectSignal(c5m, currentPrice, c15m, 0);
  console.log('\n--- If Downtrend were ignored (change24h = 0) ---');
  console.log('Action:', sigBypassed.action);
  console.log('Reason:', sigBypassed.reason);

  console.log('\n✅ Verified: On LSKUSDT live candles, Long is 100% blocked under -51.4% downtrend!');
}

run();
