/**
 * main.ts — Entry point for the Cloud-Native Focus Trading Engine
 */
import 'dotenv/config';
import { runFocusEngine } from './focus-engine';
import { startHttpServer } from './server';
import { logHealth, updateEngineStatus } from './supabase-logger';
import { checkAndExecuteVersionReset } from './version-manager';
import { CONFIG } from './config';

async function startup() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log(`║       FOCUS TRADING ENGINE  v${CONFIG.VERSION.padEnd(19)} ║`);
  console.log('║    Autonomous Quant Trader & AI Position Guardian║');
  console.log('║    Dual-LLM: Gemini 3.6 Flash + Groq Multi-Key   ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Version:       v${CONFIG.VERSION}`);
  console.log(`Mode:          ${CONFIG.DRY_RUN ? '🟡 DRY RUN (simulation)' : '🔴 LIVE TRADING'}`);
  console.log(`Watch window:  ${CONFIG.WATCH_DURATION_MS / 60000} minutes per coin`);
  console.log(`Min volume:    $${(CONFIG.MIN_VOLUME_USDT / 1e6).toFixed(1)}M USDT`);
  console.log(`Cloud Port:    ${CONFIG.PORT}`);
  console.log('');

  // 1. Version Lifecycle & Clean Slate Verification
  // Automatically detects if a new engine version was released and wipes clean stale records
  await checkAndExecuteVersionReset();

  // 2. Start HTTP / Health / Dashboard Server for Render
  startHttpServer(CONFIG.PORT);

  // 3. Log startup & initial telemetry to database
  await logHealth({
    event_type: 'ENGINE_START',
    component:  'focus-engine',
    severity:   'INFO',
    message:    `Focus Trading Engine v${CONFIG.VERSION} started. Primary LLM: Gemini(${CONFIG.GEMINI_MODEL}, ${CONFIG.GEMINI_KEYS.length} keys). Secondary: Groq(${CONFIG.GROQ_MODEL}). DryRun: ${CONFIG.DRY_RUN}`,
  });

  await updateEngineStatus({
    is_running: true,
    cycle_count: 1,
    active_trades_count: 0,
  });

  // Handle graceful shutdown
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the main 24/7 trading loop
  await runFocusEngine();
}

async function shutdown(signal: string) {
  console.log(`\n[Main] Received ${signal}. Shutting down gracefully...`);
  await updateEngineStatus({ is_running: false });
  await logHealth({
    event_type: 'ENGINE_STOP',
    component:  'focus-engine',
    severity:   'INFO',
    message:    `Engine stopped via ${signal}`,
  });
  process.exit(0);
}

startup().catch(err => {
  console.error('[Main] Fatal error:', err);
  process.exit(1);
});
