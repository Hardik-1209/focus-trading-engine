/**
 * focus-engine.ts
 * Quantitative 30-min Focus Orchestrator with Multi-Timeframe Confirmation (1m + 5m),
 * Groq Cloud LLM Validation, and ATR Volatility Targets.
 */
import { selectHottestCoin, fetchBootstrapCandles } from './coin-selector';
import { BitgetWS, TickData } from './bitget-ws';
import { detectSignal } from './signal-detector';
import { evaluateNarrative, evaluateRiskVerdict } from './llm-router';
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
} from './supabase-logger';
import { setServerFocusedCoin } from './server';
import { CONFIG, RISK, SIGNAL } from './config';
import type { Candle } from './indicators';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const lastSignalTime: Map<string, number> = new Map();
let analysisInProgress = false;

/** Watch a single coin for up to WATCH_DURATION_MS or until a trade closes */
async function watchCoin(symbol: string, cycleNumber: number): Promise<'trade_closed' | 'timeout' | 'no_trade'> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`👁  FOCUS: ${symbol} | Max watch: ${CONFIG.WATCH_DURATION_MS / 60000} min (Cycle #${cycleNumber})`);
  console.log(`${'═'.repeat(60)}\n`);

  setServerFocusedCoin(symbol, cycleNumber);
  updateEngineStatus({
    focused_symbol: symbol,
    cycle_count: cycleNumber,
    active_trades_count: getActivePositionsCount(),
    is_running: true,
  }).catch(() => {});

  // 1. Bootstrap 1m & 5m historical candles
  let bootstrapCandles1m: Candle[] = [];
  let bootstrapCandles5m: Candle[] = [];
  try {
    const [c1m, c5m] = await Promise.all([
      fetchBootstrapCandles(symbol, 60, '1m'),
      fetchBootstrapCandles(symbol, 40, '5m'),
    ]);
    bootstrapCandles1m = c1m;
    bootstrapCandles5m = c5m;
    console.log(`[Engine] Bootstrapped ${bootstrapCandles1m.length} x 1m and ${bootstrapCandles5m.length} x 5m candles`);
  } catch (err: any) {
    console.warn(`[Engine] Bootstrap warning: ${err.message}. Initializing empty buffer.`);
  }

  // 2. Connect WebSocket
  const ws = new BitgetWS(symbol);
  ws.seedCandles(bootstrapCandles1m, '1m');
  ws.seedCandles(bootstrapCandles5m, '5m');

  let tradeClosedSignal = false;
  let tradeOpened = false;
  let lastLoggedMinute = 0;

  ws.on('tick', (_tick: TickData) => {
    // Ticks are also monitored globally by position-guardian.ts
  });

  // 3. Candle 1m close event — run quantitative signal detection
  ws.on('candle1m', async (latestCandle: Candle, allCandles: Candle[]) => {
    if (tradeClosedSignal || analysisInProgress) return;
    if (tradeOpened && !hasOpenPosition(symbol)) return;

    // Don't seek new entries if already holding this symbol
    if (hasOpenPosition(symbol)) return;

    // Signal cooldown check
    const lastSig = lastSignalTime.get(symbol) || 0;
    if (Date.now() - lastSig < SIGNAL.SIGNAL_COOLDOWN_MS) return;

    // Detect signal with 5m multi-timeframe confirmation
    const signal = detectSignal(allCandles, latestCandle.close, ws.candles5m);

    // Broadcast live telemetry indicators to engine_status for dashboard
    updateEngineStatus({
      focused_symbol: symbol,
      cycle_count: cycleNumber,
      active_trades_count: getActivePositionsCount(),
      live_indicators: {
        price: latestCandle.close,
        rsi: parseFloat(signal.indicators.rsi.toFixed(1)),
        adx: parseFloat(signal.indicators.adx.toFixed(1)),
        chop: parseFloat(signal.indicators.chop.toFixed(1)),
        vwap: parseFloat(signal.indicators.vwap.toFixed(4)),
        mtf: signal.indicators.mtfTrend,
        atr: parseFloat(signal.indicators.atr.toFixed(4)),
        volZ: parseFloat(signal.indicators.volumeZ.toFixed(2)),
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});

    if (signal.action === 'WAIT') {
      if (latestCandle.timestamp !== lastLoggedMinute) {
        console.log(`[Engine] ⏳ ${signal.reason}`);
        lastLoggedMinute = latestCandle.timestamp;

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

    console.log(`\n[Engine] 🔔 Signal detected! ${signal.action} (Tier ${signal.tier})`);
    console.log(`[Engine] ${signal.reason}`);

    lastSignalTime.set(symbol, Date.now());
    analysisInProgress = true;

    try {
      let finalAction: 'LONG' | 'SHORT' | 'VETO' | 'WARN' = signal.action;
      let llmSource = 'rule-based';
      let confidenceScore = 80;

      // Tier 2 — validate with Groq Cloud LLM
      if (!signal.skipLLM) {
        console.log(`[Engine] 🤖 Tier 2 edge-case signal — requesting Groq Cloud LLM verification...`);

        const description =
          `5M_Trend=${signal.indicators.mtfTrend}, RSI=${signal.indicators.rsi.toFixed(1)}, ` +
          `ADX=${signal.indicators.adx.toFixed(1)}, ATR=${signal.indicators.atr.toFixed(4)}, ` +
          `MACD_hist=${signal.indicators.macdHist.toFixed(6)}, Price>EMA=${signal.indicators.emaCrossover}, ` +
          `VolZ=${signal.indicators.volumeZ.toFixed(2)}, Price=$${latestCandle.close}`;

        const narrative = await evaluateNarrative(symbol, description);
        llmSource = narrative.llmSource;
        confidenceScore = narrative.confidence_score;

        console.log(`[Engine] Narrative (${narrative.llmSource}): ${narrative.narrative_category} (Score: ${narrative.confidence_score}/100)`);

        const verdict = await evaluateRiskVerdict({
          symbol,
          auditBlock: { isScam: false, scamRiskScore: 2, flags: [], details: 'Audited' },
          technicalBlock: {
            emaCrossover:    signal.indicators.emaCrossover,
            latestEMA:       signal.indicators.latestEMA,
            latestADX:       signal.indicators.adx,
            latestZScore:    signal.indicators.volumeZ,
            latestRSI:       signal.indicators.rsi,
            rsiOversold:     signal.indicators.rsi < 30,
            rsiOverbought:   signal.indicators.rsi > 70,
            macdBullish:     signal.indicators.macdBullish,
            macdBearish:     signal.indicators.macdBearish,
            macdCrossUp:     signal.indicators.emaCrossover && signal.indicators.macdBullish,
            macdCrossDown:   !signal.indicators.emaCrossover && signal.indicators.macdBearish,
            latestHistogram: signal.indicators.macdHist,
          },
          narrativeBlock: {
            narrativeCategory: narrative.narrative_category,
            confidenceScore:   narrative.confidence_score,
            reasoning:         narrative.reasoning,
          },
          macroRegime:    'RISK_ON',
          isMacroHostile: false,
        });

        finalAction = verdict.verdict;
        console.log(`[Engine] LLM verdict (${verdict.llmSource}): ${finalAction} — ${verdict.reasoning}`);

        await logFocusEvent({
          event_type: 'LLM_EVALUATION',
          symbol,
          tier: signal.tier,
          llm_source: `${verdict.llmSource}: ${verdict.reasoning}`,
          action: finalAction,
          indicators: signal.indicators as any,
          message: `Groq Verdict: ${finalAction}`,
        });
      }

      // Audit signal to database
      await logMarketSignal({
        symbol,
        action: signal.action,
        tier: signal.tier,
        approved: finalAction === 'LONG' || finalAction === 'SHORT',
        llm_source: llmSource,
        confidence: confidenceScore,
        indicators: signal.indicators as any,
        reason: signal.reason,
      });

      // Execute trade if approved
      if (finalAction === 'LONG' || finalAction === 'SHORT') {
        await executeTrade(
          symbol,
          finalAction,
          latestCandle.close,
          signal.tier,
          llmSource,
          signal.indicators.atr
        );
        tradeOpened = true;
      } else {
        console.log(`[Engine] ❌ Trade skipped (${finalAction}). Continuing observation.`);
      }

    } catch (err: any) {
      console.error(`[Engine] Analysis error: ${err.message}`);
    } finally {
      analysisInProgress = false;
    }
  });

  ws.connect();

  // 4. Wait until rotation timeout or trade completes
  const watchUntil = Date.now() + CONFIG.WATCH_DURATION_MS;
  while (Date.now() < watchUntil) {
    if (tradeClosedSignal) { ws.disconnect(); return 'trade_closed'; }
    if (tradeOpened && !hasOpenPosition(symbol)) {
      console.log(`[Engine] 🏁 Trade for ${symbol} was closed by Guardian. Rotating to next volatile coin...`);
      ws.disconnect();
      return 'trade_closed';
    }
    await sleep(1000);
  }

  ws.disconnect();
  return tradeOpened ? 'no_trade' : 'no_trade';
}

async function executeTrade(
  symbol: string,
  side: 'LONG' | 'SHORT',
  price: number,
  tier: number,
  llmSource: string,
  atr = price * 0.015
) {
  if (await checkRecentTrade(symbol)) {
    console.warn(`[Engine] Idempotency guard: trade for ${symbol} placed in last 30s. Skipping.`);
    return;
  }

  const wallet    = await fetchWalletBalance();
  const margin    = 1.00; // Flat $1 margin per trade
  const posSize   = margin * RISK.LEVERAGE;
  const amount    = posSize / price;

  // Calculate ATR-based targets
  const takeProfitPrice = side === 'LONG' ? price + (atr * 3.5) : price - (atr * 3.5);
  const stopLossPrice   = side === 'LONG' ? price - (atr * 2.0) : price + (atr * 2.0);

  console.log(`\n💰 [Engine] OPENING ${side} on ${symbol}`);
  console.log(`   Wallet: $${wallet.toFixed(2)} | Margin: $${margin.toFixed(2)} | Pos: $${posSize.toFixed(2)} | Amount: ${amount.toFixed(6)}`);
  console.log(`   Entry: $${price} | ATR: ${atr.toFixed(4)} | TP: $${takeProfitPrice.toFixed(4)} | SL: $${stopLossPrice.toFixed(4)}`);
  console.log(`   Tier: ${tier} | LLM: ${llmSource}`);

  if (CONFIG.DRY_RUN) {
    console.log(`[Engine] [DRY RUN] Simulating ${side} trade for ${symbol}`);
    const tradeId = await insertFuturesTrade({
      symbol,
      position_side: side,
      amount,
      entry_price: price,
      status: 'OPEN',
      tier,
      llm_source: llmSource,
      take_profit_price: takeProfitPrice,
      stop_loss_price: stopLossPrice,
      atr,
      trailing_stop_pct: RISK.TRAILING_STOP_PCT,
    });

    registerPosition({
      tradeId,
      symbol,
      positionSide: side,
      entryPrice: price,
      amount,
      atr,
      takeProfitPrice,
      stopLossPrice,
      tier,
      llmSource,
    });

    await logFocusEvent({
      event_type: 'TRADE_OPENED',
      symbol,
      tier,
      llm_source: llmSource,
      action: side,
      indicators: { atr, entry: price },
      message: `[DRY RUN] ${side} @ $${price} | TP: $${takeProfitPrice.toFixed(4)} | SL: $${stopLossPrice.toFixed(4)}`,
    });
  }
}

/** Main infinite loop */
export async function runFocusEngine() {
  console.log('\n🤖 Focus Trading Engine starting...');
  await syncOpenPositions();

  let cycleCount = 0;

  while (true) {
    cycleCount++;
    console.log(`\n[Engine] ━━━ Cycle #${cycleCount} ━━━`);
    displayActiveTrades();

    try {
      const coin = await selectHottestCoin();
      const result = await watchCoin(coin.symbol, cycleCount);

      await logHealth({
        event_type: 'COIN_ROTATED',
        component:  'focus-engine',
        severity:   'INFO',
        message:    `Cycle #${cycleCount} finished on ${coin.symbol}. Result: ${result}. Rotating.`,
      });

      console.log(`\n[Engine] Rotation complete (${result}). Brief pause before next coin...`);
      await sleep(5000);

    } catch (err: any) {
      console.error(`[Engine] Cycle error: ${err.message}`);
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
