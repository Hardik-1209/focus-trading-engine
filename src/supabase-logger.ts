/**
 * supabase-logger.ts
 * Upgraded database logger with market_signals and engine_status telemetry.
 */
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

// ─── System Health ────────────────────────────────────────────────────────────

export async function logHealth(params: {
  event_type: string;
  component:  string;
  severity:   'INFO' | 'WARNING' | 'ERROR';
  message:    string;
  meta_data?: Record<string, any>;
}) {
  try {
    await supabase.from('system_health_events').insert({
      event_type: params.event_type,
      component:  params.component,
      severity:   params.severity,
      message:    params.message,
      meta_data:  params.meta_data || {},
      timestamp:  new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[DB] Failed to log health event: ${err.message}`);
  }
}

// ─── Engine Status & Telemetry ────────────────────────────────────────────────

export async function updateEngineStatus(status: {
  focused_symbol?: string;
  cycle_count?: number;
  active_trades_count?: number;
  active_groq_key_index?: number;
  is_running?: boolean;
  live_indicators?: Record<string, any>;
}) {
  try {
    // Calculate total trades metrics
    const { data: closedTrades } = await supabase
      .from('futures_trades')
      .select('realized_pnl')
      .eq('status', 'CLOSED');

    let totalPnl = 0;
    let wins = 0;
    const totalCount = closedTrades?.length || 0;

    if (closedTrades && closedTrades.length > 0) {
      for (const t of closedTrades) {
        const pnl = parseFloat(t.realized_pnl || '0');
        totalPnl += pnl;
        if (pnl > 0) wins++;
      }
    }
    const winRate = totalCount > 0 ? (wins / totalCount) * 100 : 0;

    const upsertData: Record<string, any> = {
      id: 'primary',
      last_heartbeat: new Date().toISOString(),
      is_running: status.is_running ?? true,
      total_pnl: parseFloat(totalPnl.toFixed(4)),
      win_rate: parseFloat(winRate.toFixed(2)),
      mode: CONFIG.DRY_RUN ? 'DRY_RUN' : 'LIVE',
      updated_at: new Date().toISOString(),
    };

    if (status.focused_symbol !== undefined) upsertData.focused_symbol = status.focused_symbol;
    if (status.cycle_count !== undefined) upsertData.cycle_count = status.cycle_count;
    if (status.active_trades_count !== undefined) upsertData.active_trades_count = status.active_trades_count;
    if (status.active_groq_key_index !== undefined) upsertData.active_groq_key_index = status.active_groq_key_index;
    if (status.live_indicators !== undefined) upsertData.live_indicators = status.live_indicators;

    await supabase.from('engine_status').upsert(upsertData);
  } catch (err: any) {
    // Non-critical, ignore silent failure
  }
}

// ─── Market Signals Deep Audit ────────────────────────────────────────────────

export async function logMarketSignal(params: {
  symbol: string;
  action: string;
  tier: number;
  approved: boolean;
  llm_source?: string;
  confidence?: number;
  indicators: Record<string, any>;
  reason: string;
}) {
  try {
    await supabase.from('market_signals').insert({
      symbol: params.symbol,
      action: params.action,
      tier: params.tier,
      approved: params.approved,
      llm_source: params.llm_source || 'none',
      confidence: params.confidence || 0,
      indicators: params.indicators,
      reason: params.reason,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[DB] Failed to log market signal: ${err.message}`);
  }
}

// ─── Wallet Balance ───────────────────────────────────────────────────────────

export async function fetchWalletBalance(): Promise<number> {
  const { data, error } = await supabase
    .from('virtual_wallet')
    .select('balance')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return 100.0;
  return parseFloat(data.balance);
}

export async function adjustWalletBalanceAtomic(pnlDelta: number): Promise<void> {
  const { data: wallet } = await supabase
    .from('virtual_wallet')
    .select('id, balance')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();
  if (!wallet) return;
  const newBalance = parseFloat(wallet.balance) + pnlDelta;
  await supabase
    .from('virtual_wallet')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);
}

// ─── Futures Trades ───────────────────────────────────────────────────────────

export async function insertFuturesTrade(params: {
  symbol:        string;
  position_side: 'LONG' | 'SHORT';
  amount:        number;
  entry_price:   number;
  status:        'OPEN' | 'FAILED';
  tier?:         number;
  llm_source?:   string;
  take_profit_price?: number;
  stop_loss_price?:   number;
  trailing_stop_pct?: number;
  atr?:               number;
  pipeline_candidate_id?: string;
}) {
  const { data, error } = await supabase
    .from('futures_trades')
    .insert({ ...params, created_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw new Error(`Insert trade failed: ${error.message}`);
  return data?.id as string;
}

export async function fetchOpenFuturesTrades() {
  const { data, error } = await supabase
    .from('futures_trades')
    .select('*')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Fetch open trades failed: ${error.message}`);
  return data || [];
}

export async function updateFuturesTrade(id: string, updates: {
  status?:       'OPEN' | 'CLOSED' | 'FAILED';
  exit_price?:   number;
  realized_pnl?: number;
  closed_at?:    string;
  exit_reason?:  string;
  fee?:          number;
  return_pct?:   number;
}) {
  const { error } = await supabase
    .from('futures_trades')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Update trade failed: ${error.message}`);
}

export async function checkRecentTrade(symbol: string, windowMs = 30000): Promise<boolean> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data } = await supabase
    .from('futures_trades')
    .select('id')
    .eq('symbol', symbol)
    .gte('created_at', since)
    .limit(1);
  return (data?.length || 0) > 0;
}

// ─── Focus Engine Events ──────────────────────────────────────────────────────

export async function logFocusEvent(params: {
  event_type:  string;
  symbol:      string;
  tier?:       number;
  llm_source?: string;
  action?:     string;
  indicators?: Record<string, any>;
  message:     string;
}) {
  try {
    await logHealth({
      event_type: params.event_type,
      component:  'focus-engine',
      severity:   params.action === 'WAIT' ? 'INFO' : 'WARNING',
      message:    `[${params.symbol}] ${params.message}`,
      meta_data:  params,
    });
  } catch (err: any) {
    console.error(`[DB] Focus event log failed: ${err.message}`);
  }
}
