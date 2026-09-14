"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logHealth = logHealth;
exports.getLatestInMemoryStatus = getLatestInMemoryStatus;
exports.resetInMemoryStatus = resetInMemoryStatus;
exports.updateEngineStatus = updateEngineStatus;
exports.logMarketSignal = logMarketSignal;
exports.fetchWalletBalance = fetchWalletBalance;
exports.adjustWalletBalanceAtomic = adjustWalletBalanceAtomic;
exports.fetchCurrentEngineCycle = fetchCurrentEngineCycle;
exports.getActiveSessionId = getActiveSessionId;
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
const risk_governor_1 = require("./risk-governor");
const gemini_client_1 = require("./gemini-client");
const supabase = (0, supabase_js_1.createClient)(config_1.CONFIG.SUPABASE_URL, config_1.CONFIG.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
});
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
// In-memory status cache for instantaneous <5ms /health responses
let latestInMemoryStatus = {
    id: 'primary',
    is_running: true,
    last_heartbeat: new Date().toISOString(),
    cycle_count: 1,
    active_trades_count: 0,
    win_rate: 0,
    total_pnl: 0,
    focused_symbol: 'Scanning...',
    mode: config_1.CONFIG.DRY_RUN ? `DRY_RUN (v${config_1.CONFIG.VERSION})` : `LIVE (v${config_1.CONFIG.VERSION})`,
    live_indicators: {
        regime: 'ACTIVE_CONCURRENT_SCAN',
        version: config_1.CONFIG.VERSION,
    },
};
function getLatestInMemoryStatus() {
    return latestInMemoryStatus;
}
/** Reset in-memory telemetry to clean slate values for a new version */
function resetInMemoryStatus(version = config_1.CONFIG.VERSION) {
    latestInMemoryStatus = {
        id: 'primary',
        is_running: true,
        last_heartbeat: new Date().toISOString(),
        cycle_count: 1,
        active_trades_count: 0,
        win_rate: 0,
        total_pnl: 0,
        focused_symbol: `Scanning (v${version} Clean Slate)...`,
        mode: config_1.CONFIG.DRY_RUN ? `DRY_RUN (v${version})` : `LIVE (v${version})`,
        live_indicators: {
            price: 0,
            regime: 'ACTIVE_CONCURRENT_SCAN',
            timestamp: new Date().toISOString(),
            version: version,
            risk_governor: risk_governor_1.riskGovernor.getStatus(),
            gemini_cluster: (0, gemini_client_1.getGeminiTelemetry)(),
        },
    };
    console.log(`[Supabase Logger] 🧠 In-memory status cache reset to clean slate for v${version}.`);
}
async function updateEngineStatus(status) {
    try {
        // Calculate total trades metrics for active (unarchived) session
        const { data: closedTrades } = await supabase
            .from('futures_trades')
            .select('realized_pnl')
            .eq('status', 'CLOSED')
            .or('is_archived.is.null,is_archived.eq.false');
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
        const govStatus = risk_governor_1.riskGovernor.getStatus();
        const mergedIndicators = {
            ...(status.live_indicators || {}),
            version: config_1.CONFIG.VERSION,
            risk_governor: govStatus,
            gemini_cluster: (0, gemini_client_1.getGeminiTelemetry)(),
        };
        const upsertData = {
            id: 'primary',
            last_heartbeat: new Date().toISOString(),
            is_running: status.is_running ?? true,
            total_pnl: parseFloat(totalPnl.toFixed(4)),
            win_rate: parseFloat(winRate.toFixed(2)),
            mode: config_1.CONFIG.DRY_RUN ? `DRY_RUN (v${config_1.CONFIG.VERSION})` : `LIVE (v${config_1.CONFIG.VERSION})`,
            updated_at: new Date().toISOString(),
            live_indicators: mergedIndicators,
        };
        if (status.focused_symbol !== undefined)
            upsertData.focused_symbol = status.focused_symbol;
        if (status.cycle_count !== undefined)
            upsertData.cycle_count = status.cycle_count;
        if (status.active_trades_count !== undefined)
            upsertData.active_trades_count = status.active_trades_count;
        if (status.active_groq_key_index !== undefined)
            upsertData.active_groq_key_index = status.active_groq_key_index;
        latestInMemoryStatus = { ...latestInMemoryStatus, ...upsertData };
        await supabase.from('engine_status').upsert(upsertData);
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
async function fetchCurrentEngineCycle() {
    try {
        const { data } = await supabase
            .from('engine_status')
            .select('cycle_count')
            .eq('id', 'primary')
            .single();
        return data?.cycle_count || 1;
    }
    catch {
        return 1;
    }
}
async function getActiveSessionId() {
    try {
        const { data } = await supabase
            .from('trading_sessions')
            .select('id')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        return data?.id || 'session_1';
    }
    catch {
        return 'session_1';
    }
}
async function insertFuturesTrade(params) {
    const sessionId = params.session_id || await getActiveSessionId();
    const { data, error } = await supabase
        .from('futures_trades')
        .insert({
        ...params,
        session_id: sessionId,
        is_archived: false,
        created_at: new Date().toISOString()
    })
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