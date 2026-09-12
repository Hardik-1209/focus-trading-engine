import { BitgetWS } from './src/bitget-ws';

const ws = new BitgetWS('RDWUSDT');
ws.connect();

setTimeout(() => {
  ws.disconnect();
  process.exit(0);
}, 5000);
