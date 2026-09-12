/**
 * main.ts — Entry point for the Cloud-Native Focus Trading Engine
 */
import 'dotenv/config';
import { runFocusEngine } from './focus-engine';
import { startHttpServer } from './server';
import { logHealth, updateEngineStatus } from './supabase-logger';
import { CONFIG } from './config';

async function startup() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       CLOUD FOCUS TRADING ENGINE  v2.0           ║');
  console.log('║    One coin. Always watching. Strike on signal.  ║');
  console.log('║    Powered by Groq Cloud LLM Multi-Key Array     ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Mode:          ${CONFIG.DRY_RUN ? '🟡 DRY RUN (simulation)' : '🔴 LIVE TRADING'}`);
  console.log(`Watch window:  ${CONFIG.WATCH_DURATION_MS / 60000} minutes per coin`);
  console.log(`Min volume:    $${(CONFIG.MIN_VOLUME_USDT / 1e6).toFixed(1)}M USDT`);
  console.log(`Cloud Port:    ${CONFIG.PORT}`);
  console.log('');

  // LLM Status
  console.log('── LLM Status ──────────────────────────────────────');
  console.log(`✅ Groq Cloud LLM (${CONFIG.GROQ_MODEL}) — PRIMARY`);
  console.log(`✅ Active Key Pool: ${CONFIG.GROQ_KEYS.length} key(s) with auto-rotation & 429 failover`);
  console.log('');

  // Start HTTP / Health / Dashboard Server for Render
  startHttpServer(CONFIG.PORT);

  // Log startup & initial telemetry to database
  await logHealth({
    event_type: 'ENGINE_START',
    component:  'focus-engine',
    severity:   'INFO',
    message:    `Focus Trading Engine v2.0 started. Cloud LLM: Groq(${CONFIG.GROQ_MODEL}). Keys: ${CONFIG.GROQ_KEYS.length}. DryRun: ${CONFIG.DRY_RUN}`,
  });

  await updateEngineStatus({
    is_running: true,
    cycle_count: 0,
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
