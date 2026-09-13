import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useGlobalStore } from '../store/useGlobalStore';
import type { FocusLog, HealthEvent, FuturesTrade } from '../store/useGlobalStore';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabase = (() => {
  try {
    if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('https://') && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined') {
      return createClient(supabaseUrl, supabaseAnonKey);
    }
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
  return null;
})();

/**
 * Recalculates dashboard telemetry metrics based on active (unarchived) trades.
 */
function recalculateTelemetry(trades: FuturesTrade[]) {
  const activeTrades = trades.filter(t => !t.is_archived);
  const closedTrades = activeTrades.filter(t => t.status === 'CLOSED');
  const totalClosed = closedTrades.length;
  
  let realizedPnl = 0;
  let winningTradesCount = 0;

  for (const t of closedTrades) {
    const pnl = t.realized_pnl ? parseFloat(t.realized_pnl as any) : 0;
    realizedPnl += pnl;
    if (pnl > 0) {
      winningTradesCount++;
    }
  }

  const winRate = totalClosed > 0 ? winningTradesCount / totalClosed : 0;

  return {
    totalTrades: activeTrades.length,
    winRate,
    realizedPnl
  };
}

export function useSupabaseStream() {
  const {
    setFocusLogs,
    addFocusLog,
    trades,
    setTrades,
    addTrade,
    updateTrade,
    setHealthEvents,
    addHealthEvent,
    updateTelemetry,
    setWalletBalance,
    setEngineStatus,
    setSessions,
  } = useGlobalStore();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      console.warn("Supabase credentials missing. Realtime streaming disabled.");
      return;
    }

    // 1. Fetch initial pipeline logs
    const fetchInitialLogs = async () => {
      try {
        const { data, error } = await client
          .from('system_health_events')
          .select('id, timestamp, meta_data')
          .eq('component', 'focus-engine')
          .order('timestamp', { ascending: false })
          .limit(100);
        if (error) throw error;
        if (data) {
          const mappedLogs = data.map((d: any) => ({
             id: d.id,
             created_at: d.timestamp,
             event_type: d.event_type || d.meta_data?.event_type || 'UNKNOWN',
             symbol: d.meta_data?.symbol || 'SYS',
             ...d.meta_data
          })) as FocusLog[];
          setFocusLogs(mappedLogs);
        }
      } catch (err) {
        console.error("Error fetching initial focus logs:", err);
      }
    };

    // 2. Fetch initial trades (up to 150 to keep mobile payload lean and fast)
    const fetchInitialTrades = async () => {
      try {
        const { data, error } = await client
          .from('futures_trades')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(150);
        if (error) throw error;
        if (data) {
          const parsedTrades = data as FuturesTrade[];
          setTrades(parsedTrades);
          // Recalculate based on active unarchived trades
          const metrics = recalculateTelemetry(parsedTrades);
          updateTelemetry(metrics);
        }
      } catch (err) {
        console.error("Error fetching initial trades:", err);
      }
    };

    // 3. Fetch initial health events
    const fetchInitialHealth = async () => {
      try {
        const { data, error } = await client
          .from('system_health_events')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(30);
        if (error) throw error;
        if (data) setHealthEvents(data as HealthEvent[]);
      } catch (err) {
        console.error("Error fetching initial health events:", err);
      }
    };

    // 3b. Fetch initial virtual wallet balance
    const fetchInitialWallet = async () => {
      try {
        const { data, error } = await client
          .from('virtual_wallet')
          .select('balance')
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();
        if (error) throw error;
        if (data) setWalletBalance(parseFloat(data.balance));
      } catch (err) {
        console.error("Error fetching initial wallet balance:", err);
        setWalletBalance(10.00); // fallback
      }
    };

    // 3c. Fetch initial engine status with fast local /health endpoint first (<10ms RAM read)
    const fetchInitialEngineStatus = async () => {
      try {
        const res = await fetch('/health');
        if (res.ok) {
          const h = await res.json();
          if (typeof h.wallet_balance === 'number') {
            setWalletBalance(h.wallet_balance);
          }
          setEngineStatus({
            id: 'primary',
            is_running: true,
            focused_symbol: h.focused_coin,
            cycle_count: h.cycle_count,
            active_trades_count: h.active_positions_count,
            live_indicators: {
              ...(h.live_indicators || {}),
              gemini_cluster: h.gemini_cluster,
              risk_governor: h.risk_governor,
            },
            updated_at: h.timestamp,
          } as any);
          return;
        }
      } catch {
        // Fallback to Supabase direct query
      }

      try {
        const { data } = await client
          .from('engine_status')
          .select('*')
          .eq('id', 'primary')
          .single();
        if (data) setEngineStatus(data);
      } catch { /* ignore fallback */ }
    };

    // 3d. Fetch initial trading sessions
    const fetchInitialSessions = async () => {
      try {
        const { data, error } = await client
          .from('trading_sessions')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setSessions(data as any);
      } catch (err) {
        console.error("Error fetching initial sessions:", err);
      }
    };

    fetchInitialLogs();
    fetchInitialTrades();
    fetchInitialHealth();
    fetchInitialWallet();
    fetchInitialEngineStatus();
    fetchInitialSessions();

    // 4. Real-time Listeners
    const engineStatusChannel = client
      .channel('engine_status_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'engine_status' },
        (payload) => {
          if (payload.new) setEngineStatus(payload.new as any);
        }
      )
      .subscribe();
    const pipelineChannel = client
      .channel('pipeline_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_health_events', filter: "component=eq.focus-engine" },
        (payload) => {
          if (payload.new) {
            const newEvt = payload.new as any;
            addFocusLog({
              id: newEvt.id,
              created_at: newEvt.timestamp,
              event_type: newEvt.event_type || newEvt.meta_data?.event_type || 'UNKNOWN',
              symbol: newEvt.meta_data?.symbol || 'SYS',
              ...newEvt.meta_data
            } as FocusLog);
          }
        }
      )
      .subscribe();

    const tradesChannel = client
      .channel('trade_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'futures_trades' },
        (payload) => {
          if (payload.new) {
            addTrade(payload.new as FuturesTrade);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'futures_trades' },
        (payload) => {
          if (payload.new) {
            updateTrade(payload.new as FuturesTrade);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateTelemetry({ websocketConnected: true });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          updateTelemetry({ websocketConnected: false });
        }
      });

    const healthChannel = client
      .channel('health_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_health_events' },
        (payload) => {
          if (payload.new) {
            addHealthEvent(payload.new as HealthEvent);
          }
        }
      )
      .subscribe();

    const walletChannel = client
      .channel('wallet_changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'virtual_wallet' },
        (payload) => {
          if (payload.new && payload.new.balance) {
            setWalletBalance(parseFloat(payload.new.balance));
          }
        }
      )
      .subscribe();

    const sessionsChannel = client
      .channel('sessions_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trading_sessions' },
        () => {
          fetchInitialSessions();
        }
      )
      .subscribe();

    // Lightweight polling interval: fast /health status every 3.5s (<10ms in-memory read)
    const statusPollInterval = setInterval(() => {
      fetchInitialEngineStatus();
    }, 3500);

    // Gentle background sync for trades and sessions every 60s
    const backgroundSyncInterval = setInterval(() => {
      fetchInitialTrades();
      fetchInitialSessions();
    }, 60000);

    return () => {
      clearInterval(statusPollInterval);
      clearInterval(backgroundSyncInterval);
      client.removeChannel(engineStatusChannel);
      client.removeChannel(pipelineChannel);
      client.removeChannel(tradesChannel);
      client.removeChannel(healthChannel);
      client.removeChannel(walletChannel);
      client.removeChannel(sessionsChannel);
    };
  }, [setFocusLogs, setTrades, setHealthEvents, addFocusLog, addTrade, updateTrade, addHealthEvent, updateTelemetry, setWalletBalance, setEngineStatus, setSessions]);

  // Recalculate metrics when trades change
  useEffect(() => {
    const metrics = recalculateTelemetry(trades);
    updateTelemetry(metrics);
  }, [trades, updateTelemetry]);
}
