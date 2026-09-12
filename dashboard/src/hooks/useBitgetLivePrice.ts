import { useEffect, useRef } from 'react';
import { useGlobalStore } from '../store/useGlobalStore';

/**
 * React hook to subscribe to Bitget public futures tickers via real-time WebSockets
 * for all open active positions.
 */
export function useBitgetLivePrice() {
  const { trades, setLivePrice } = useGlobalStore();
  const wsRef = useRef<WebSocket | null>(null);

  // Extract unique active futures trades symbols (e.g. BTCUSDT, ZECUSDT)
  const activeSymbols = Array.from(
    new Set(
      trades
        .filter((t) => t.status === 'OPEN')
        .map((t) => t.symbol)
    )
  ).sort();

  useEffect(() => {
    if (activeSymbols.length === 0) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    console.log(`[Bitget WS] Connecting for symbols: ${activeSymbols.join(', ')}`);
    
    // Connect to public futures ticker WebSocket
    const ws = new WebSocket('wss://ws.bitget.com/v2/ws/public');
    wsRef.current = ws;

    let pingInterval: any;

    ws.onopen = () => {
      console.log('[Bitget WS] Connection established successfully.');
      
      // Subscribe to all active symbols
      const subscribeMsg = {
        op: 'subscribe',
        args: activeSymbols.map((symbol) => ({
          instType: 'USDT-FUTURES',
          channel: 'ticker',
          instId: symbol,
        })),
      };
      
      ws.send(JSON.stringify(subscribeMsg));

      // Setup 30-second ping interval to keep connection alive
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        // Bitget responds to ping with a 'pong' string
        if (event.data === 'pong') {
          return;
        }

        const msg = JSON.parse(event.data);
        if (msg && msg.data && Array.isArray(msg.data)) {
          for (const tick of msg.data) {
            if (tick.instId && tick.lastPr) {
              const price = parseFloat(tick.lastPr);
              if (!isNaN(price)) {
                setLivePrice(tick.instId, price);
              }
            }
          }
        }
      } catch (err) {
        // Silent catch for system heartbeats or unformatted logs
      }
    };

    ws.onerror = (error) => {
      console.error('[Bitget WS] Connection encountered an error:', error);
    };

    ws.onclose = (event) => {
      console.log('[Bitget WS] Connection closed:', event.reason);
      clearInterval(pingInterval);
    };

    // Cleanup hook on active symbols lists change or unmount
    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [JSON.stringify(activeSymbols)]);
}
