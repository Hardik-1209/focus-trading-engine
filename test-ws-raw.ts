import WebSocket from 'ws';

const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({
    op: 'subscribe',
    args: [
      { instType: 'USDT-FUTURES', channel: 'ticker', instId: 'BTCUSDT' },
      { instType: 'USDT-FUTURES', channel: 'candle1m', instId: 'BTCUSDT' }
    ]
  }));
});

ws.on('message', (data) => {
  const str = data.toString();
  if (str.includes('candle1m')) {
    console.log('CANDLE MSG:', str);
  }
});

ws.on('close', (code, reason) => {
  console.log('Closed', code, reason.toString());
});

ws.on('error', (err) => {
  console.log('Error', err);
});
