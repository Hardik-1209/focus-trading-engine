"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * main.ts — Entry point for the Cloud-Native Focus Trading Engine
 */
require("dotenv/config");
const focus_engine_1 = require("./focus-engine");
const server_1 = require("./server");
const supabase_logger_1 = require("./supabase-logger");
const version_manager_1 = require("./version-manager");
const config_1 = require("./config");
async function startup() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log(`║       FOCUS TRADING ENGINE  v${config_1.CONFIG.VERSION.padEnd(19)} ║`);
    console.log('║    Autonomous Quant Trader & AI Position Guardian║');
    console.log('║    Dual-LLM: Gemini 3.6 Flash + Groq Multi-Key   ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Version:       v${config_1.CONFIG.VERSION}`);
    console.log(`Mode:          ${config_1.CONFIG.DRY_RUN ? '🟡 DRY RUN (simulation)' : '🔴 LIVE TRADING'}`);
    console.log(`Watch window:  ${config_1.CONFIG.WATCH_DURATION_MS / 60000} minutes per coin`);
    console.log(`Min volume:    $${(config_1.CONFIG.MIN_VOLUME_USDT / 1e6).toFixed(1)}M USDT`);
    console.log(`Cloud Port:    ${config_1.CONFIG.PORT}`);
    console.log('');
    // 1. Version Lifecycle & Clean Slate Verification
    // Automatically detects if a new engine version was released and wipes clean stale records
    await (0, version_manager_1.checkAndExecuteVersionReset)();
    // 2. Start HTTP / Health / Dashboard Server for Render
    (0, server_1.startHttpServer)(config_1.CONFIG.PORT);
    // 3. Log startup & initial telemetry to database
    await (0, supabase_logger_1.logHealth)({
        event_type: 'ENGINE_START',
        component: 'focus-engine',
        severity: 'INFO',
        message: `Focus Trading Engine v${config_1.CONFIG.VERSION} started. Primary LLM: Gemini(${config_1.CONFIG.GEMINI_MODEL}, ${config_1.CONFIG.GEMINI_KEYS.length} keys). Secondary: Groq(${config_1.CONFIG.GROQ_MODEL}). DryRun: ${config_1.CONFIG.DRY_RUN}`,
    });
    await (0, supabase_logger_1.updateEngineStatus)({
        is_running: true,
        cycle_count: 1,
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