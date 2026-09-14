async function run() {
  const res = await fetch('https://focus-trading-engine.onrender.com/health');
  const d = await res.json() as any;
  console.log('Live Version:', d.version);
  console.log('Active Positions Count:', d.active_positions_count);
  console.log('Wallet Balance:', d.wallet_balance);
  console.log('Gemini Keys Total:', d.live_indicators?.gemini_cluster?.totalKeys);
}
run();
