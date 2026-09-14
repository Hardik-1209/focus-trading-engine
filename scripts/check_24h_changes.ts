async function run() {
  const symbols = ['TUSDT', 'CVCUSDT', 'PUNDIXUSDT', 'MINAUSDT', 'LSKUSDT'];
  const res = await fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
  const json = await res.json() as any;
  const map = new Map();
  for (const t of json.data || []) {
    map.set(t.symbol, t);
  }
  for (const sym of symbols) {
    const t = map.get(sym);
    if (t) {
      console.log(`${sym}: 24h change = ${(parseFloat(t.change24h) * 100).toFixed(2)}%, price = ${t.lastPr}, vol = $${(parseFloat(t.usdtVolume)/1e6).toFixed(2)}M`);
    } else {
      console.log(`${sym}: Not found`);
    }
  }
}
run();
