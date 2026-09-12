"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * main.ts — Entry point for the Cloud-Native Focus Trading Engine
 */
require("dotenv/config");
const focus_engine_1 = require("./focus-engine");
const server_1 = require("./server");
const supabase_logger_1 = require("./supabase-logger");
const config_1 = require("./config");
async function startup() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       CLOUD FOCUS TRADING ENGINE  v2.0           ║');
    console.log('║    One coin. Always watching. Strike on signal.  ║');
    console.log('║    Powered by Groq Cloud LLM Multi-Key Array     ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Mode:          ${config_1.CONFIG.DRY_RUN ? '🟡 DRY RUN (simulation)' : '🔴 LIVE TRADING'}`);
    console.log(`Watch window:  ${config_1.CONFIG.WATCH_DURATION_MS / 60000} minutes per coin`);
    console.log(`Min volume:    $${(config_1.CONFIG.MIN_VOLUME_USDT / 1e6).toFixed(1)}M USDT`);
    console.log(`Cloud Port:    ${config_1.CONFIG.PORT}`);
    console.log('');
    // LLM Status
    console.log('── LLM Status ──────────────────────────────────────');
    console.log(`✅ Groq Cloud LLM (${config_1.CONFIG.GROQ_MODEL}) — PRIMARY`);
    console.log(`✅ Active Key Pool: ${config_1.CONFIG.GROQ_KEYS.length} key(s) with auto-rotation & 429 failover`);
    console.log('');
    // Start HTTP / Health / Dashboard Server for Render
    (0, server_1.startHttpServer)(config_1.CONFIG.PORT);
    // Log startup & initial telemetry to database
    await (0, supabase_logger_1.logHealth)({
        event_type: 'ENGINE_START',
        component: 'focus-engine',
        severity: 'INFO',
        message: `Focus Trading Engine v2.0 started. Cloud LLM: Groq(${config_1.CONFIG.GROQ_MODEL}). Keys: ${config_1.CONFIG.GROQ_KEYS.length}. DryRun: ${config_1.CONFIG.DRY_RUN}`,
    });
    await (0, supabase_logger_1.updateEngineStatus)({
        is_running: true,
        cycle_count: 0,
        active_trades_count: 0,
    });
    // Handle graceful shutdown
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    // Start the main 24/7 trading loop
    await (0, focus_engine_1.runFocusEngine)();
}
async function shutdown(signal) {
    console.log(`\n[Main] Received ${signal}. Shutting down gracefully...`);
    await (0, supabase_logger_1.updateEngineStatus)({ is_running: false });
    await (0, supabase_logger_1.logHealth)({
        event_type: 'ENGINE_STOP',
        component: 'focus-engine',
        severity: 'INFO',
        message: `Engine stopped via ${signal}`,
    });
    process.exit(0);
}
startup().catch(err => {
    console.error('[Main] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map