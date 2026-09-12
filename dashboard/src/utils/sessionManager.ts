import { supabase } from '../hooks/useSupabaseStream';
import type { FuturesTrade } from '../store/useGlobalStore';

/**
 * Archives current active session trades, records the session in trading_sessions,
 * and resets wallet balance to $10.00 and engine_status cycle count to 1.
 */
export async function resetTradingSession(params: {
  sessionName?: string;
  currentTrades: FuturesTrade[];
  currentWalletBalance: number;
  inrRate: number;
}): Promise<{ success: boolean; newSessionId: string; error?: string }> {
  if (!supabase) {
    return { success: false, newSessionId: '', error: 'Supabase client not initialized' };
  }

  try {
    const now = new Date().toISOString();
    const sessionId = `session_${Date.now()}`;
    const name = params.sessionName || `Snapshot — ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

    // 1. Calculate current session stats
    const activeClosedTrades = params.currentTrades.filter(t => !t.is_archived && t.status === 'CLOSED');
    let totalPnl = 0;
    let wins = 0;
    for (const t of activeClosedTrades) {
      const pnl = typeof t.realized_pnl === 'number' ? t.realized_pnl : parseFloat((t.realized_pnl as any) || '0');
      totalPnl += pnl;
      if (pnl > 0) wins++;
    }
    const winRate = activeClosedTrades.length > 0 ? (wins / activeClosedTrades.length) * 100 : 0;

    // 2. Insert archived session snapshot record into trading_sessions
    await supabase.from('trading_sessions').insert({
      id: sessionId,
      name,
      created_at: now,
      closed_at: now,
      initial_balance: 10.00,
      final_balance: params.currentWalletBalance,
      total_trades: activeClosedTrades.length,
      win_rate: parseFloat(winRate.toFixed(2)),
      total_pnl: parseFloat(totalPnl.toFixed(4)),
      is_active: false,
    });

    // 3. Soft-delete / archive active trades by setting is_archived = true
    await supabase
      .from('futures_trades')
      .update({ is_archived: true, session_id: sessionId })
      .or('is_archived.is.null,is_archived.eq.false');

    // 4. Reset virtual wallet balance to baseline $10.00 USDT
    await supabase
      .from('virtual_wallet')
      .update({ balance: 10.00, updated_at: now })
      .neq('balance', -999999);

    // 5. Reset engine_status cycle count to 1, total_pnl to 0, win_rate to 0
    await supabase
      .from('engine_status')
      .update({
        cycle_count: 1,
        total_pnl: 0,
        win_rate: 0,
        active_trades_count: 0,
        updated_at: now,
      })
      .eq('id', 'primary');

    // 6. Create next active session
    const nextSessionId = `session_active_${Date.now()}`;
    await supabase.from('trading_sessions').insert({
      id: nextSessionId,
      name: `Active Live Session (${new Date().toLocaleDateString('en-GB')})`,
      created_at: now,
      initial_balance: 10.00,
      total_trades: 0,
      win_rate: 0,
      total_pnl: 0,
      is_active: true,
    });

    return { success: true, newSessionId: nextSessionId };
  } catch (err: any) {
    console.error('Failed to reset session:', err);
    return { success: false, newSessionId: '', error: err.message };
  }
}
