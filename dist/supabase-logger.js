"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHealth = logHealth;
exports.updateEngineStatus = updateEngineStatus;
exports.logMarketSignal = logMarketSignal;
exports.fetchWalletBalance = fetchWalletBalance;
exports.adjustWalletBalanceAtomic = adjustWalletBalanceAtomic;
exports.insertFuturesTrade = insertFuturesTrade;
exports.fetchOpenFuturesTrades = fetchOpenFuturesTrades;
exports.updateFuturesTrade = updateFuturesTrade;
exports.checkRecentTrade = checkRecentTrade;
exports.logFocusEvent = logFocusEvent;
/**
 * supabase-logger.ts
 * Upgraded database logger with market_signals and engine_status telemetry.
 */
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
const supabase = (0, supabase_js_1.createClient)(config_1.CONFIG.SUPABASE_URL, config_1.CONFIG.SUPABASE_SERVICE_ROLE_KEY);
// ─── System Health ────────────────────────────────────────────────────────────
async function logHealth(params) {
    try {
        await supabase.from('system_health_events').insert({
            event_type: params.event_type,
            component: params.component,
            severity: params.severity,
            message: params.message,
            meta_data: params.meta_data || {},
            timestamp: new Date().toISOString(),
        });
    }
    catch (err) {
        console.error(`[DB] Failed to log health event: ${err.message}`);
    }
}
// ─── Engine Status & Telemetry ────────────────────────────────────────────────
async function updateEngineStatus(status) {
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
                if (pnl > 0)
                    wins++;
            }
        }
        const winRate = totalCount > 0 ? (wins / totalCount) * 100 : 0;
        await supabase.from('engine_status').upsert({
            id: 'primary',
            last_heartbeat: new Date().toISOString(),
            is_running: status.is_running ?? true,
            focused_symbol: status.focused_symbol,
            cycle_count: status.cycle_count,
            active_trades_count: status.active_trades_count,
            active_groq_key_index: status.active_groq_key_index ?? 0,
            total_pnl: parseFloat(totalPnl.toFixed(4)),
            win_rate: parseFloat(winRate.toFixed(2)),
            mode: config_1.CONFIG.DRY_RUN ? 'DRY_RUN' : 'LIVE',
            updated_at: new Date().toISOString(),
        });
    }
    catch (err) {
        // Non-critical, ignore silent failure
    }
}
// ─── Market Signals Deep Audit ────────────────────────────────────────────────
async function logMarketSignal(params) {
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
    }
    catch (err) {
        console.error(`[DB] Failed to log market signal: ${err.message}`);
    }
}
// ─── Wallet Balance ───────────────────────────────────────────────────────────
async function fetchWalletBalance() {
    const { data, error } = await supabase
        .from('virtual_wallet')
        .select('balance')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
    if (error || !data)
        return 100.0;
    return parseFloat(data.balance);
}
async function adjustWalletBalanceAtomic(pnlDelta) {
    const { data: wallet } = await supabase
        .from('virtual_wallet')
        .select('id, balance')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
    if (!wallet)
        return;
    const newBalance = parseFloat(wallet.balance) + pnlDelta;
    await supabase
        .from('virtual_wallet')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);
}
// ─── Futures Trades ───────────────────────────────────────────────────────────
async function insertFuturesTrade(params) {
    const { data, error } = await supabase
        .from('futures_trades')
        .insert({ ...params, created_at: new Date().toISOString() })
        .select('id')
        .single();
    if (error)
        throw new Error(`Insert trade failed: ${error.message}`);
    return data?.id;
}
async function fetchOpenFuturesTrades() {
    const { data, error } = await supabase
        .from('futures_trades')
        .select('*')
        .eq('status', 'OPEN')
        .order('created_at', { ascending: true });
    if (error)
        throw new Error(`Fetch open trades failed: ${error.message}`);
    return data || [];
}
async function updateFuturesTrade(id, updates) {
    const { error } = await supabase
        .from('futures_trades')
        .update(updates)
        .eq('id', id);
    if (error)
        throw new Error(`Update trade failed: ${error.message}`);
}
async function checkRecentTrade(symbol, windowMs = 30000) {
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
async function logFocusEvent(params) {
    try {
        await logHealth({
            event_type: params.event_type,
            component: 'focus-engine',
            severity: params.action === 'WAIT' ? 'INFO' : 'WARNING',
            message: `[${params.symbol}] ${params.message}`,
            meta_data: params,
        });
    }
    catch (err) {
        console.error(`[DB] Focus event log failed: ${err.message}`);
    }
}
//# sourceMappingURL=supabase-logger.js.map