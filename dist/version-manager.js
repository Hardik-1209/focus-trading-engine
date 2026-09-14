"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCleanSlateReset = executeCleanSlateReset;
exports.checkAndExecuteVersionReset = checkAndExecuteVersionReset;
/**
 * version-manager.ts
 * Automated Version Lifecycle & Clean Slate Data Reset Engine.
 *
 * Ensures that whenever a new version of the engine is released:
 * 1. Previous active session trades are cleanly archived into historical snapshots.
 * 2. Any lingering open positions are safely closed and marked archived.
 * 3. Virtual wallet is reset to $10.00 baseline capital.
 * 4. Engine status (PnL, win rate, cycle count) and Risk Governor are wiped clean in DB and in-memory.
 * 5. Position Guardian and Supabase logger in-memory caches are synchronously purged.
 */
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("./config");
const risk_governor_1 = require("./risk-governor");
const supabase_logger_1 = require("./supabase-logger");
const position_guardian_1 = require("./position-guardian");
const supabase = (0, supabase_js_1.createClient)(config_1.CONFIG.SUPABASE_URL, config_1.CONFIG.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
/**
 * Executes a full Clean Slate data reset for the given engine version.
 * Resets database records and purges all in-memory structures synchronously.
 */
async function executeCleanSlateReset(targetVersion = config_1.CONFIG.VERSION, force = false) {
    const now = new Date().toISOString();
    console.log(`\n🧹 [VersionManager] Initializing Clean Slate Reset for v${targetVersion} (Force: ${force})...`);
    try {
        // 1. Fetch all currently unarchived trades
        const { data: activeTrades, error: tradesErr } = await supabase
            .from('futures_trades')
            .select('*')
            .or('is_archived.is.null,is_archived.eq.false')
            .order('created_at', { ascending: true });
        if (tradesErr) {
            console.error('[VersionManager] Error fetching unarchived trades:', tradesErr);
        }
        const tradeCount = activeTrades?.length || 0;
        console.log(`[VersionManager] Found ${tradeCount} unarchived trade(s) to archive.`);
        let totalPnl = 0;
        let wins = 0;
        for (const t of activeTrades || []) {
            const pnl = parseFloat(t.realized_pnl || '0');
            totalPnl += pnl;
            if (pnl > 0)
                wins++;
        }
        const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;
        // 2. Fetch current active session to archive it
        const { data: currentSession } = await supabase
            .from('trading_sessions')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();
        if (currentSession) {
            console.log(`[VersionManager] Archiving previous active session: ${currentSession.id}...`);
            await supabase.from('trading_sessions').update({
                is_active: false,
                closed_at: now,
                total_trades: tradeCount,
                win_rate: parseFloat(winRate.toFixed(2)),
                total_pnl: parseFloat(totalPnl.toFixed(4)),
                final_balance: parseFloat((10.00 + totalPnl).toFixed(4)),
            }).eq('id', currentSession.id);
        }
        // 3. Mark all unarchived trades as archived and close open positions
        if (tradeCount > 0) {
            const { error: archiveErr } = await supabase
                .from('futures_trades')
                .update({
                is_archived: true,
                status: 'CLOSED',
                exit_reason: `VERSION_RESET_V${targetVersion}`,
            })
                .or('is_archived.is.null,is_archived.eq.false');
            if (archiveErr) {
                console.error('[VersionManager] Error archiving trades:', archiveErr);
            }
            else {
                console.log(`[VersionManager] ✅ ${tradeCount} trade(s) marked archived.`);
            }
        }
        // 4. Deactivate all older sessions
        await supabase
            .from('trading_sessions')
            .update({ is_active: false })
            .neq('id', 'dummy');
        // 5. Create new Active session record for targetVersion
        const cleanVer = targetVersion.replace(/\./g, '');
        const newSessionId = `session_v${cleanVer}_active`;
        console.log(`[VersionManager] Creating new active session: ${newSessionId}...`);
        const { error: sessionErr } = await supabase.from('trading_sessions').upsert({
            id: newSessionId,
            name: `v${targetVersion} Autonomous Quant & AI Guardian (Active)`,
            created_at: now,
            initial_balance: 10.00,
            final_balance: 10.00,
            total_trades: 0,
            win_rate: 0.00,
            total_pnl: 0.00,
            is_active: true,
        });
        if (sessionErr) {
            console.error('[VersionManager] Error creating new active session:', sessionErr);
        }
        else {
            console.log(`[VersionManager] ✅ Active session ${newSessionId} created.`);
        }
        // 6. Reset virtual wallet to $10.00 baseline
        console.log('[VersionManager] Resetting virtual_wallet to $10.00 USDT baseline...');
        const { error: walletErr } = await supabase
            .from('virtual_wallet')
            .update({
            balance: 10.00,
            updated_at: now,
        })
            .neq('balance', -999999);
        if (walletErr) {
            console.error('[VersionManager] Error resetting virtual_wallet:', walletErr);
        }
        else {
            console.log('[VersionManager] ✅ virtual_wallet balance set to $10.00.');
        }
        // 7. Reset in-memory states synchronously
        risk_governor_1.riskGovernor.resetForNewVersion(10.00);
        (0, position_guardian_1.clearActivePositionsInMemory)();
        (0, supabase_logger_1.resetInMemoryStatus)(targetVersion);
        // 8. Reset engine_status in Supabase
        console.log(`[VersionManager] Resetting engine_status to cycle 1 for v${targetVersion}...`);
        const { error: statusErr } = await supabase.from('engine_status').upsert({
            id: 'primary',
            last_heartbeat: now,
            is_running: true,
            focused_symbol: `Scanning (v${targetVersion} Clean Slate)...`,
            cycle_count: 1,
            active_trades_count: 0,
            win_rate: 0.00,
            total_pnl: 0.00,
            active_groq_key_index: 0,
            mode: config_1.CONFIG.DRY_RUN ? `DRY_RUN (v${targetVersion})` : `LIVE (v${targetVersion})`,
            updated_at: now,
            live_indicators: {
                price: 0,
                regime: 'ACTIVE_CONCURRENT_SCAN',
                timestamp: now,
                version: targetVersion,
                risk_governor: risk_governor_1.riskGovernor.getStatus(),
            },
        });
        if (statusErr) {
            console.error('[VersionManager] Error updating engine_status:', statusErr);
        }
        else {
            console.log('[VersionManager] ✅ engine_status reset to clean cycle 1.');
        }
        // 9. Log system health event
        await (0, supabase_logger_1.logHealth)({
            event_type: 'VERSION_LIFECYCLE_RESET',
            component: 'version-manager',
            severity: 'INFO',
            message: `Clean Slate data reset completed for v${targetVersion}. Archived ${tradeCount} trades. Wallet: $10.00. Session: ${newSessionId}.`,
            meta_data: { targetVersion, newSessionId, archivedTradesCount: tradeCount },
        });
        return {
            success: true,
            newSessionId,
            archivedTradesCount: tradeCount,
            message: `Clean Slate reset successful for v${targetVersion}. Baseline set to $10.00.`,
        };
    }
    catch (err) {
        console.error('[VersionManager] Fatal error during clean slate reset:', err);
        return {
            success: false,
            newSessionId: '',
            archivedTradesCount: 0,
            message: err.message,
            error: err.message,
        };
    }
}
/**
 * Checks on engine startup if a new engine version or release has occurred.
 * If current CONFIG.VERSION does not match the active session or stored engine status,
 * automatically executes a Clean Slate data reset.
 */
async function checkAndExecuteVersionReset() {
    try {
        console.log(`[VersionManager] 🔍 Verifying version lifecycle state for v${config_1.CONFIG.VERSION}...`);
        // 1. Check engine_status
        const { data: statusData } = await supabase
            .from('engine_status')
            .select('mode, live_indicators')
            .eq('id', 'primary')
            .maybeSingle();
        const storedVersion = statusData?.live_indicators?.version;
        const cleanVer = config_1.CONFIG.VERSION.replace(/\./g, '');
        const expectedSessionId = `session_v${cleanVer}_active`;
        // 2. Check active session
        const { data: activeSession } = await supabase
            .from('trading_sessions')
            .select('id, name, is_active')
            .eq('is_active', true)
            .maybeSingle();
        const versionMismatch = storedVersion !== config_1.CONFIG.VERSION;
        const sessionMismatch = !activeSession || activeSession.id !== expectedSessionId;
        if (versionMismatch || sessionMismatch) {
            console.log(`[VersionManager] 🚀 New engine release detected! ` +
                `Current: v${config_1.CONFIG.VERSION} | Stored: ${storedVersion || 'none'} | Active Session: ${activeSession?.id || 'none'}`);
            console.log(`[VersionManager] 🧹 Triggering automatic Clean Slate reset...`);
            await executeCleanSlateReset(config_1.CONFIG.VERSION, true);
            return true;
        }
        console.log(`[VersionManager] ✅ Version v${config_1.CONFIG.VERSION} is current and active (Session: ${activeSession.id}).`);
        return false;
    }
    catch (err) {
        console.warn(`[VersionManager] Non-fatal check error: ${err.message}`);
        return false;
    }
}
//# sourceMappingURL=version-manager.js.map