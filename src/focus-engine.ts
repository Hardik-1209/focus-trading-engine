/**
 * focus-engine.ts (v3.2)
 * High-Cadence Concurrent Basket Quantitative Engine
 *
 * Architecture:
 * 1. Evaluates Top 15 liquid Bitget futures pairs in parallel every 20s.
 * 2. Tri-Setup Quantitative Scanner:
 *    - 15m/5m Trend Continuation Pullbacks
 *    - 15m Range-Bound Mean Reversions
 *    - 5m Microstructure Momentum Breakouts
 * 3. AI CRO Auditor: Google Gemini 3.6 Flash (6-Key rotation array, 90 req/min).
 * 4. Multi-Position Guardian: Up to 4 concurrent positions with flat $1.00 margin (3x leverage).
 */
import { getTopCandidateBasket, fetchBootstrapCandles, fetchCurrentPrice, CoinCandidate } from './coin-selector';
import { detectSignal, DetectedSignal } from './signal-detector';
import { evaluateRiskVerdict } from './llm-router';
import { riskGovernor } from './risk-governor';
import {
  syncOpenPositions,
  hasOpenPosition,
  registerPosition,
  displayActiveTrades,
  getActivePositionsCount,
  onTick,
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

// In-memory candle cache (30-second TTL) to minimize redundant Bitget REST calls
interface CachedCandles {
  timestamp: number;
  candles5m: Candle[];
  candles15m: Candle[];
}
const candleCache: Map<string, CachedCandles> = new Map();

async function getCandlesWithCache(symbol: string): Promise<{ c5m: Candle[]; c15m: Candle[] }> {
  const cached = candleCache.get(symbol);
  if (cached && (Date.now() - cached.timestamp < 25000)) {
    return { c5m: cached.candles5m, c15m: cached.candles15m };
  }

  const [c5m, c15m] = await Promise.all([
    fetchBootstrapCandles(symbol, 60, '5m'),
    fetchBootstrapCandles(symbol, 40, '15m'),
  ]);

  candleCache.set(symbol, {
    timestamp: Date.now(),
    candles5m: c5m,
    candles15m: c15m,
  });

  return { c5m, c15m };
}

/** Execute trade in database, register in Position Guardian, and log */
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
    console.warn(`[Engine v3.2] Idempotency guard: trade for ${symbol} placed recently. Skipping.`);
    return;
  }

  const wallet    = await fetchWalletBalance();
  const margin    = RISK.MARGIN_PER_TRADE; // Flat $1.00 margin per trade
  const posSize   = margin * RISK.LEVERAGE; // $3.00 notional at 3x leverage
  const amount    = posSize / entryPrice;

  console.log(`\n💰 [Engine v3.2] OPENING ${side} on ${symbol}`);
  console.log(`   Wallet: $${wallet.toFixed(2)} | Margin: $${margin.toFixed(2)} | Notional: $${posSize.toFixed(2)} (${RISK.LEVERAGE}x)`);
  console.log(`   Entry: $${entryPrice} | SL: $${stopLossPrice.toFixed(4)} | TP: $${takeProfitPrice.toFixed(4)} | Planned R:R: ${plannedRR}:1`);

  if (CONFIG.DRY_RUN) {
    console.log(`[Engine v3.2] [DRY RUN] Simulating ${side} trade for ${symbol}`);
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
      message: `[DRY RUN v3.2] ${side} @ $${entryPrice} | TP: $${takeProfitPrice.toFixed(4)} | SL: $${stopLossPrice.toFixed(4)} (RR: ${plannedRR}:1)`,
    });
  }
}

/** Evaluate a single candidate asset for trade entry */
async function evaluateCandidate(
  candidate: CoinCandidate,
  cycleNumber: number
): Promise<boolean> {
  const symbol = candidate.symbol;

  // 1. Guard checks
  if (hasOpenPosition(symbol)) return false;
  const govCheck = riskGovernor.canTradeSymbol(symbol);
  if (!govCheck.allowed) return false;

  const lastSig = lastSignalTime.get(symbol) || 0;
  if (Date.now() - lastSig < SIGNAL.SIGNAL_COOLDOWN_MS) return false;

  try {
    // 2. Fetch candles
    const { c5m, c15m } = await getCandlesWithCache(symbol);
    if (c5m.length < 20 || c15m.length < 20) return false;

    const latestCandle = c5m[c5m.length - 1];
    const currentPrice = latestCandle.close;

    // 3. Quantitative Tri-Setup Signal Detection
    const signal = detectSignal(c5m, currentPrice, c15m);

    if (signal.action === 'WAIT') {
      return false;
    }

    console.log(`\n[Engine v3.2] 🔔 Opportunity Detected on ${symbol}! Action: ${signal.action} | Planned RR: ${signal.plannedRR}:1`);
    console.log(`[Engine v3.2] Setup: ${signal.reason}`);

    lastSignalTime.set(symbol, Date.now());

    // 4. Autonomous Senior Quant Trader Evaluation via Google Gemini 3.6 Flash
    console.log(`[Engine v3.3] 🧠 Routing setup on ${symbol} to Gemini 3.6 Flash Autonomous Trader...`);
    const verdict = await evaluateRiskVerdict({
      symbol,
      action: signal.action,
      plannedRR: signal.plannedRR,
      stopLossPrice: signal.stopLossPrice,
      takeProfitPrice: signal.takeProfitPrice,
      fundingRate: candidate.fundingRate,
      candles15m: c15m,
      candles5m: c5m,
      walletBalance: 10.00,
      technicalBlock: {
        rsi5m: signal.indicators.rsi5m,
        atr5m: signal.indicators.atr5m,
        volumeZ5m: signal.indicators.volumeZ5m,
        vwap5m: signal.indicators.vwap5m,
        regime15m: signal.indicators.regime15m,
        adx15m: signal.indicators.adx15m,
        chop15m: signal.indicators.chop15m,
        currentPrice,
        swingLow: signal.indicators.swingLow,
        swingHigh: signal.indicators.swingHigh,
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
      reason: `${signal.reason} | Trader Decision: ${verdict.decision} (WinProb: ${verdict.winProbability}%) | Analysis: ${verdict.marketStructureAnalysis || ''} | Reason: ${verdict.reasoning}`,
    });

    if (approved) {
      let finalAction = signal.action;
      if (verdict.decision === 'EXECUTE_LONG') finalAction = 'LONG';
      if (verdict.decision === 'EXECUTE_SHORT') finalAction = 'SHORT';

      let finalStopLoss = signal.stopLossPrice;
      let finalTakeProfit = signal.takeProfitPrice;

      // Sanity check structural SL from LLM:
      if (verdict.suggestedStopLoss && verdict.suggestedStopLoss > 0) {
        if (finalAction === 'LONG') {
          const slDistPct = (currentPrice - verdict.suggestedStopLoss) / currentPrice;
          if (slDistPct >= 0.005 && slDistPct <= 0.045) {
            finalStopLoss = verdict.suggestedStopLoss;
            console.log(`[Engine v3.3] 🎯 Using Gemini Structural Stop Loss @ $${finalStopLoss.toFixed(4)} (-${(slDistPct * 100).toFixed(2)}%)`);
          }
        } else if (finalAction === 'SHORT') {
          const slDistPct = (verdict.suggestedStopLoss - currentPrice) / currentPrice;
          if (slDistPct >= 0.005 && slDistPct <= 0.045) {
            finalStopLoss = verdict.suggestedStopLoss;
            console.log(`[Engine v3.3] 🎯 Using Gemini Structural Stop Loss @ $${finalStopLoss.toFixed(4)} (-${(slDistPct * 100).toFixed(2)}%)`);
          }
        }
      }

      if (verdict.suggestedTakeProfit && verdict.suggestedTakeProfit > 0) {
        if (finalAction === 'LONG' && verdict.suggestedTakeProfit > currentPrice) {
          finalTakeProfit = verdict.suggestedTakeProfit;
        } else if (finalAction === 'SHORT' && verdict.suggestedTakeProfit < currentPrice) {
          finalTakeProfit = verdict.suggestedTakeProfit;
        }
      }

      const riskDist = Math.abs(currentPrice - finalStopLoss);
      const rewardDist = Math.abs(finalTakeProfit - currentPrice);
      const finalRR = riskDist > 0 ? parseFloat((rewardDist / riskDist).toFixed(2)) : signal.plannedRR;

      console.log(`[Engine v3.3] 🎯 TRADE APPROVED BY QUANT TRADER (${verdict.decision} | WinProb: ${verdict.winProbability}% | Conf: ${verdict.confidence}/100): Executing ${finalAction} on ${symbol}!`);

      await executeTrade(
        symbol,
        finalAction,
        currentPrice,
        finalStopLoss,
        finalTakeProfit,
        signal.atr,
        finalRR,
        verdict.llmSource,
        llmReasoning,
        signal.indicators
      );
      return true;
    } else {
      console.log(`[Engine v3.3] 🛡️ Trader stood aside on ${symbol} (Decision: ${verdict.decision}, WinProb: ${verdict.winProbability}%). Capital protected.`);
      return false;
    }

  } catch (err: any) {
    console.error(`[Engine v3.2] Evaluation error on ${symbol}: ${err.message}`);
    return false;
  }
}

/** REST Watchdog for Position Guardian to ensure exit triggers never lag */
function startPositionGuardianWatchdog() {
  setInterval(async () => {
    const activeCount = getActivePositionsCount();
    if (activeCount === 0) return;

    try {
      const basket = await getTopCandidateBasket(30).catch(() => []);
      const priceMap = new Map<string, number>();
      for (const b of basket) {
        priceMap.set(b.symbol, b.lastPrice);
      }

      for (const [sym, _] of lastSignalTime.entries()) {
        const price = priceMap.get(sym);
        if (price) {
          onTick({
            symbol: sym,
            lastPrice: price,
            bestBid: price,
            bestAsk: price,
            volume24h: 0,
            change24h: 0,
            ts: Date.now(),
          });
        }
      }
    } catch {
      // Non-critical background watchdog
    }
  }, 5000);
}

/** Main High-Cadence Concurrent Trading Loop */
export async function runFocusEngine() {
  console.log('\n🤖 Focus Trading Engine v3.3 starting (Autonomous Senior Quant Trader + Raw Candles)...');
  await syncOpenPositions();
  startPositionGuardianWatchdog();

  // Initialize Risk Governor starting balance and reset circuit breaker on deployment
  const initialWallet = await fetchWalletBalance().catch(() => 10.00);
  riskGovernor.setStartingBalance(initialWallet);
  riskGovernor.resetDailyCircuitBreaker();

  let cycleCount = await fetchCurrentEngineCycle();

  while (true) {
    cycleCount++;
    console.log(`\n[Engine v3.3] ━━━ Scan Cycle #${cycleCount} ━━━`);
    displayActiveTrades();

    // 1. Check Daily Drawdown Circuit Breaker
    const govStatus = riskGovernor.getStatus();
    if (govStatus.dailyHalted) {
      console.warn(`[Engine v3.3] 🛑 DAILY DRAWDOWN KILL SWITCH ACTIVE. Waiting 60s for next UTC day...`);
      await sleep(60000);
      continue;
    }

    try {
      const activePositionsCount = getActivePositionsCount();
      const openSlots = CONFIG.MAX_CONCURRENT_POSITIONS - activePositionsCount;

      // 2. Fetch top 15 high-momentum liquid candidates
      const basket = await getTopCandidateBasket(CONFIG.MAX_CANDIDATES_POOL);
      const topSymbol = basket[0]?.symbol || 'SOLUSDT';
      setServerFocusedCoin(topSymbol, cycleCount);

      // Broadcast scanner state
      await updateEngineStatus({
        focused_symbol: `Scanning ${basket.length} Liquid Assets (${activePositionsCount}/${CONFIG.MAX_CONCURRENT_POSITIONS} active)`,
        cycle_count: cycleCount,
        active_trades_count: activePositionsCount,
        live_indicators: {
          price: basket[0]?.lastPrice || 0,
          regime: 'ACTIVE_CONCURRENT_SCAN',
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      if (openSlots <= 0) {
        console.log(`[Engine v3.2] 🔒 All ${CONFIG.MAX_CONCURRENT_POSITIONS} position slots active. Guardian managing dynamic exits...`);
      } else {
        console.log(`[Engine v3.2] 🔍 Evaluating ${basket.length} assets concurrently. Slots available: ${openSlots}/${CONFIG.MAX_CONCURRENT_POSITIONS}`);

        let filledThisCycle = 0;

        // Evaluate candidates concurrently in batches of 3
        for (let i = 0; i < basket.length; i += 3) {
          if (getActivePositionsCount() >= CONFIG.MAX_CONCURRENT_POSITIONS) break;

          const batch = basket.slice(i, i + 3);
          const results = await Promise.all(batch.map(c => evaluateCandidate(c, cycleCount)));

          for (const opened of results) {
            if (opened) filledThisCycle++;
          }

          if (getActivePositionsCount() >= CONFIG.MAX_CONCURRENT_POSITIONS) {
            console.log(`[Engine v3.2] 🎯 Max concurrent positions (${CONFIG.MAX_CONCURRENT_POSITIONS}) reached.`);
            break;
          }
          await sleep(150);
        }
      }

      await logHealth({
        event_type: 'CYCLE_COMPLETED',
        component:  'focus-engine',
        severity:   'INFO',
        message:    `Scan Cycle #${cycleCount} completed across ${basket.length} candidates. Active positions: ${getActivePositionsCount()}/${CONFIG.MAX_CONCURRENT_POSITIONS}.`,
      });

      // Sleep between scanner passes
      await sleep(CONFIG.SCANNER_INTERVAL_MS);

    } catch (err: any) {
      console.error(`[Engine v3.2] Cycle error: ${err.message}`);
      await logHealth({
        event_type: 'CYCLE_ERROR',
        component:  'focus-engine',
        severity:   'ERROR',
        message:    err.message,
      });
      await sleep(10000);
    }
  }
}
