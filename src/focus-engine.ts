/**
 * focus-engine.ts (v3.0)
 * Quantitative 15m/5m Multi-Timeframe Focus Orchestrator with Adversarial Groq Risk Auditor,
 * Risk Governor Circuit Breakers, and Dynamic Triple Barrier Geometry.
 */
import { selectHottestCoin, fetchBootstrapCandles } from './coin-selector';
import { BitgetWS, TickData } from './bitget-ws';
import { detectSignal } from './signal-detector';
import { evaluateNarrative, evaluateRiskVerdict } from './llm-router';
import { riskGovernor } from './risk-governor';
import {
  syncOpenPositions,
  hasOpenPosition,
  registerPosition,
  displayActiveTrades,
  getActivePositionsCount,
} from './position-guardian';
import {
  insertFuturesTrade,
  fetchWalletBalance,
  checkRecentTrade,
  logHealth,
  logFocusEvent,
  logMarketSignal,
  updateEngineStatus,
  fetchCurrentEngineCycle,
} from './supabase-logger';
import { setServerFocusedCoin } from './server';
import { CONFIG, RISK, SIGNAL } from './config';
import type { Candle } from './indicators';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const lastSignalTime: Map<string, number> = new Map();
let analysisInProgress = false;

/** Watch a single coin on 15m/5m candles until trade closes, timeout, or chop exit */
async function watchCoin(symbol: string, cycleNumber: number, fundingRate?: number): Promise<'trade_closed' | 'timeout' | 'no_trade' | 'stagnant_rotated'> {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`👁  FOCUS v3.0: ${symbol} | Max watch: ${CONFIG.WATCH_DURATION_MS / 60000} min (Cycle #${cycleNumber})`);
  console.log(`${'═'.repeat(65)}\n`);

  setServerFocusedCoin(symbol, cycleNumber);
  updateEngineStatus({
    focused_symbol: symbol,
    cycle_count: cycleNumber,
    active_trades_count: getActivePositionsCount(),
    is_running: true,
  }).catch(() => {});

  // 1. Bootstrap 5m & 15m historical candles
  let bootstrapCandles5m: Candle[] = [];
  let bootstrapCandles15m: Candle[] = [];
  try {
    const [c5m, c15m] = await Promise.all([
      fetchBootstrapCandles(symbol, 60, '5m'),
      fetchBootstrapCandles(symbol, 40, '15m'),
    ]);
    bootstrapCandles5m = c5m;
    bootstrapCandles15m = c15m;
    console.log(`[Engine v3.0] Bootstrapped ${bootstrapCandles5m.length} x 5m and ${bootstrapCandles15m.length} x 15m candles`);
  } catch (err: any) {
    console.warn(`[Engine] Bootstrap warning: ${err.message}. Initializing empty buffers.`);
  }

  // 2. Connect WebSocket
  const ws = new BitgetWS(symbol);
  ws.seedCandles(bootstrapCandles5m, '5m');
  ws.seedCandles(bootstrapCandles15m, '15m');

  updateEngineStatus({
    focused_symbol: symbol,
    cycle_count: cycleNumber,
    active_trades_count: getActivePositionsCount(),
    live_indicators: {
      price: bootstrapCandles5m[bootstrapCandles5m.length - 1]?.close || 0,
      timestamp: new Date().toISOString(),
    },
  }).catch(() => {});

  let tradeOpened = false;
  let lastLoggedBar = 0;
  let stagnantCandlesCount = 0;

  // 3. Candle 5m close event — run quantitative 15m/5m signal detection
  ws.on('candle5m', async (latestCandle: Candle, allCandles5m: Candle[], allCandles15m: Candle[]) => {
    if (analysisInProgress) return;
    if (tradeOpened && !hasOpenPosition(symbol)) return;
    if (hasOpenPosition(symbol)) return;

    // Check Risk Governor circuit breaker
    const govCheck = riskGovernor.canTradeSymbol(symbol);
    if (!govCheck.allowed) {
      console.warn(`[Engine v3.0] Symbol ${symbol} blocked by Risk Governor: ${govCheck.reason}`);
      return;
    }

    // Cooldown check
    const lastSig = lastSignalTime.get(symbol) || 0;
    if (Date.now() - lastSig < SIGNAL.SIGNAL_COOLDOWN_MS) return;

    // Run multi-timeframe signal detection
    const signal = detectSignal(allCandles5m, latestCandle.close, allCandles15m);

    // Broadcast live telemetry
    updateEngineStatus({
      focused_symbol: symbol,
      cycle_count: cycleNumber,
      active_trades_count: getActivePositionsCount(),
      live_indicators: {
        price: latestCandle.close,
        rsi: signal.indicators.rsi5m,
        adx: signal.indicators.adx15m,
        chop: signal.indicators.chop15m,
        vwap: signal.indicators.vwap5m,
        regime: signal.indicators.regime15m,
        atr: signal.indicators.atr5m,
        volZ: signal.indicators.volumeZ5m,
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    if (signal.action === 'WAIT') {
      if (signal.regime === 'VOLATILE_CHOP' || signal.regime === 'RANGING') {
        stagnantCandlesCount++;
      } else {
        stagnantCandlesCount = 0;
      }

      if (latestCandle.timestamp !== lastLoggedBar) {
        console.log(`[Engine v3.0] ⏳ ${signal.reason}`);
        lastLoggedBar = latestCandle.timestamp;

        await logFocusEvent({
          event_type: 'SYSTEM_PING',
          symbol,
          action: 'WAIT',
          indicators: signal.indicators as any,
          message: signal.reason,
        });
      }
      return;
    }

    console.log(`\n[Engine v3.0] 🔔 Setup detected! Action: ${signal.action} | Planned RR: ${signal.plannedRR}:1`);
    console.log(`[Engine v3.0] ${signal.reason}`);

    lastSignalTime.set(symbol, Date.now());
    analysisInProgress = true;

    try {
      // 4. Adversarial Chief Risk Officer (CRO) Audit via Groq
      console.log(`[Engine v3.0] 🛡️ Routing setup to Adversarial Groq CRO for 5-point disqualification audit...`);

      const verdict = await evaluateRiskVerdict({
        symbol,
        action: signal.action,
        plannedRR: signal.plannedRR,
        stopLossPrice: signal.stopLossPrice,
        takeProfitPrice: signal.takeProfitPrice,
        fundingRate,
        technicalBlock: {
          rsi5m: signal.indicators.rsi5m,
          atr5m: signal.indicators.atr5m,
          volumeZ5m: signal.indicators.volumeZ5m,
          vwap5m: signal.indicators.vwap5m,
          regime15m: signal.indicators.regime15m,
          adx15m: signal.indicators.adx15m,
          chop15m: signal.indicators.chop15m,
          currentPrice: latestCandle.close,
        },
      });

      const approved = verdict.verdict === 'APPROVE';
      const llmReasoning = `[${verdict.llmSource}] ${verdict.reasoning}`;

      // Audit signal to database
      await logMarketSignal({
        symbol,
        action: signal.action,
        tier: 2,
        approved,
        llm_source: verdict.llmSource,
        confidence: verdict.confidence,
        indicators: signal.indicators as any,
        reason: `${signal.reason} | CRO Verdict: ${verdict.verdict} (${verdict.reasoning})`,
      });

      if (approved) {
        console.log(`[Engine v3.0] 🎯 CRO AUDIT PASSED: Executing ${signal.action} trade!`);

        await executeTrade(
          symbol,
          signal.action,
          latestCandle.close,
          signal.stopLossPrice,
          signal.takeProfitPrice,
          signal.atr,
          signal.plannedRR,
          verdict.llmSource,
          llmReasoning,
          signal.indicators
        );
        tradeOpened = true;
      } else {
        console.log(`[Engine v3.0] ❌ Trade VETOED by CRO (${verdict.reasoning}). Capital protected.`);
      }

    } catch (err: any) {
      console.error(`[Engine v3.0] Analysis error: ${err.message}`);
    } finally {
      analysisInProgress = false;
    }
  });

  ws.connect();

  // 5. Watch loop
  const watchUntil = Date.now() + CONFIG.WATCH_DURATION_MS;
  const minWatchUntil = Date.now() + 180000; // Allow at least 3 minutes

  while (Date.now() < watchUntil) {
    if (tradeOpened && !hasOpenPosition(symbol)) {
      console.log(`[Engine v3.0] 🏁 Trade for ${symbol} completed. Rotating to next volatile coin...`);
      ws.disconnect();
      return 'trade_closed';
    }

    // Early exit if 3 consecutive 5m candles in chop
    if (!tradeOpened && Date.now() > minWatchUntil && stagnantCandlesCount >= 3) {
      console.log(`[Engine v3.0] ⚡ Early rotation triggered for ${symbol}: 3 consecutive choppy candles. Rotating...`);
      ws.disconnect();
      return 'stagnant_rotated';
    }

    await sleep(1000);
  }

  ws.disconnect();
  return tradeOpened ? 'no_trade' : 'timeout';
}

async function executeTrade(
  symbol: string,
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number,
  atr: number,
  plannedRR: number,
  llmSource: string,
  aiReasoning: string,
  indicatorsAtEntry: Record<string, any> = {}
) {
  if (await checkRecentTrade(symbol)) {
    console.warn(`[Engine v3.0] Idempotency guard: trade for ${symbol} placed recently. Skipping.`);
    return;
  }

  const wallet    = await fetchWalletBalance();
  const margin    = RISK.MARGIN_PER_TRADE; // Flat $1.00 margin per trade
  const posSize   = margin * RISK.LEVERAGE; // $3.00 notional at 3x leverage
  const amount    = posSize / entryPrice;

  console.log(`\n💰 [Engine v3.0] OPENING ${side} on ${symbol}`);
  console.log(`   Wallet: $${wallet.toFixed(2)} | Margin: $${margin.toFixed(2)} | Notional: $${posSize.toFixed(2)} (${RISK.LEVERAGE}x)`);
  console.log(`   Entry: $${entryPrice} | SL: $${stopLossPrice.toFixed(4)} | TP: $${takeProfitPrice.toFixed(4)} | Planned R:R: ${plannedRR}:1`);

  if (CONFIG.DRY_RUN) {
    console.log(`[Engine v3.0] [DRY RUN] Simulating ${side} trade for ${symbol}`);
    const tradeId = await insertFuturesTrade({
      symbol,
      position_side: side,
      amount,
      entry_price: entryPrice,
      status: 'OPEN',
      tier: 2,
      llm_source: llmSource,
      ai_reasoning: aiReasoning,
      indicators_at_entry: indicatorsAtEntry,
      take_profit_price: takeProfitPrice,
      stop_loss_price: stopLossPrice,
      atr,
      trailing_stop_pct: RISK.TRAILING_STOP_ATR_MULT,
    });

    registerPosition({
      tradeId,
      symbol,
      positionSide: side,
      entryPrice,
      amount,
      atr,
      takeProfitPrice,
      stopLossPrice,
      tier: 2,
      llmSource,
    });

    await logFocusEvent({
      event_type: 'TRADE_OPENED',
      symbol,
      tier: 2,
      llm_source: llmSource,
      action: side,
      indicators: { atr, entry: entryPrice, plannedRR },
      message: `[DRY RUN v3.0] ${side} @ $${entryPrice} | TP: $${takeProfitPrice.toFixed(4)} | SL: $${stopLossPrice.toFixed(4)} (RR: ${plannedRR}:1)`,
    });
  }
}

/** Main infinite trading loop */
export async function runFocusEngine() {
  console.log('\n🤖 Focus Trading Engine v3.0 starting...');
  await syncOpenPositions();

  // Initialize Risk Governor starting balance
  const initialWallet = await fetchWalletBalance().catch(() => 10.00);
  riskGovernor.setStartingBalance(initialWallet);

  while (true) {
    const cycleCount = await fetchCurrentEngineCycle();
    console.log(`\n[Engine v3.0] ━━━ Cycle #${cycleCount} ━━━`);
    displayActiveTrades();

    const govStatus = riskGovernor.getStatus();
    if (govStatus.dailyHalted) {
      console.warn(`[Engine v3.0] 🛑 DAILY DRAWDOWN KILL SWITCH ACTIVE. Waiting 60s for next UTC day...`);
      await sleep(60000);
      continue;
    }

    try {
      await updateEngineStatus({
        focused_symbol: 'Scanning market (v3.0)...',
        cycle_count: cycleCount,
        active_trades_count: getActivePositionsCount(),
      }).catch(() => {});

      const coin = await selectHottestCoin();
      const result = await watchCoin(coin.symbol, cycleCount, coin.fundingRate);

      const nextCycle = cycleCount + 1;
      await updateEngineStatus({
        cycle_count: nextCycle,
        active_trades_count: getActivePositionsCount(),
      }).catch(() => {});

      await logHealth({
        event_type: 'COIN_ROTATED',
        component:  'focus-engine',
        severity:   'INFO',
        message:    `Cycle #${cycleCount} finished on ${coin.symbol}. Result: ${result}. Rotating.`,
      });

      console.log(`\n[Engine v3.0] Rotation complete (${result}). Inter-cycle pause...`);
      await sleep(3000);

    } catch (err: any) {
      console.error(`[Engine v3.0] Cycle error: ${err.message}`);
      await logHealth({
        event_type: 'CYCLE_ERROR',
        component:  'focus-engine',
        severity:   'ERROR',
        message:    err.message,
      });
      await sleep(15000);
    }
  }
}
