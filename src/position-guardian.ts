/**
 * position-guardian.ts (v3.0)
 * High-precision position guardian with structural ATR stops, dynamic breakeven,
 * and Risk Governor streak callbacks.
 */
import { RISK, CONFIG } from './config';
import {
  fetchOpenFuturesTrades,
  updateFuturesTrade,
  fetchWalletBalance,
  adjustWalletBalanceAtomic,
  updateEngineStatus,
  logFocusEvent,
} from './supabase-logger';
import { riskGovernor } from './risk-governor';
import type { TickData } from './bitget-ws';
import WebSocket from 'ws';

export interface ActivePosition {
  tradeId:          string;
  symbol:           string;
  positionSide:     'LONG' | 'SHORT';
  entryPrice:       number;
  amount:           number;
  openedAt:         number;
  peakPrice:        number;
  atr?:             number;
  trailingStopPct?: number;
  takeProfitPrice?: number;
  stopLossPrice?:   number;
  isBreakevenSet?:  boolean;
  tier?:            number;
  llmSource?:       string;
  isClosing?:       boolean;
}

const activePositions: Map<string, ActivePosition> = new Map();

let guardianWs: WebSocket | null = null;
let guardianPingTimer: NodeJS.Timeout | null = null;
const subscribedSymbols: Set<string> = new Set();

function startGuardianWs() {
  if (guardianWs && guardianWs.readyState === WebSocket.OPEN) return;
  console.log(`[Guardian v3.0] Connecting to Bitget WS to monitor active positions...`);
  guardianWs = new WebSocket('wss://ws.bitget.com/v2/ws/public');

  guardianWs.on('open', () => {
    console.log(`[Guardian v3.0] ✅ Connected to Bitget WS. Actively monitoring ticks.`);
    guardianPingTimer = setInterval(() => {
      if (guardianWs?.readyState === WebSocket.OPEN) guardianWs.send('ping');
    }, 20000);
    updateGuardianSubscriptions();
  });

  guardianWs.on('message', (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.event === 'subscribe') return;
      if (msg.data && msg.arg?.channel === 'ticker') {
        const data = msg.data[0];
        const tick: TickData = {
          symbol: msg.arg.instId,
          lastPrice: parseFloat(data.lastPr || data.last || '0'),
          bestBid: parseFloat(data.bidPr || data.bid1 || '0'),
          bestAsk: parseFloat(data.askPr || data.ask1 || '0'),
          volume24h: parseFloat(data.baseVolume || data.vol24h || '0'),
          change24h: parseFloat(data.change24h || '0') * 100,
          ts: parseInt(data.ts || String(Date.now())),
        };
        onTick(tick);
      }
    } catch { /* ignore malformed */ }
  });

  guardianWs.on('close', () => {
    if (guardianPingTimer) clearInterval(guardianPingTimer);
    guardianWs = null;
    subscribedSymbols.clear();
    if (activePositions.size > 0) {
      setTimeout(startGuardianWs, 2000);
    }
  });

  guardianWs.on('error', (err) => {
    console.error(`[Guardian] WS Error: ${err.message}`);
    guardianWs?.terminate();
  });
}

function updateGuardianSubscriptions() {
  if (!guardianWs || guardianWs.readyState !== WebSocket.OPEN) {
    if (activePositions.size > 0) startGuardianWs();
    return;
  }

  const currentSymbols = new Set(activePositions.keys());

  // Unsubscribe from removed symbols
  const toUnsubscribe = [...subscribedSymbols].filter(s => !currentSymbols.has(s));
  if (toUnsubscribe.length > 0) {
    const args = toUnsubscribe.map(sym => ({ instType: 'USDT-FUTURES', channel: 'ticker', instId: sym }));
    guardianWs.send(JSON.stringify({ op: 'unsubscribe', args }));
    toUnsubscribe.forEach(s => subscribedSymbols.delete(s));
  }

  // Subscribe to new symbols
  const toSubscribe = [...currentSymbols].filter(s => !subscribedSymbols.has(s));
  if (toSubscribe.length > 0) {
    const args = toSubscribe.map(sym => ({ instType: 'USDT-FUTURES', channel: 'ticker', instId: sym }));
    guardianWs.send(JSON.stringify({ op: 'subscribe', args }));
    toSubscribe.forEach(s => subscribedSymbols.add(s));
  }
}

export function displayActiveTrades() {
  console.log(`\n================= 📊 LIVE ACTIVE TRADES 📊 =================`);
  if (activePositions.size === 0) {
    console.log(`  No open trades currently.`);
  } else {
    for (const [sym, pos] of activePositions.entries()) {
      console.log(`  ➤ ${sym} [${pos.positionSide}] | Entry: $${pos.entryPrice.toFixed(4)} | SL: $${pos.stopLossPrice?.toFixed(4)} | TP: $${pos.takeProfitPrice?.toFixed(4)}`);
    }
  }
  console.log(`============================================================\n`);
}

export async function syncOpenPositions() {
  const trades = await fetchOpenFuturesTrades();
  activePositions.clear();
  for (const t of trades) {
    activePositions.set(t.symbol, {
      tradeId:          t.id,
      symbol:           t.symbol,
      positionSide:     t.position_side as 'LONG' | 'SHORT',
      entryPrice:       parseFloat(t.entry_price),
      amount:           parseFloat(t.amount),
      openedAt:         new Date(t.created_at).getTime(),
      peakPrice:        parseFloat(t.entry_price),
      atr:              t.atr ? parseFloat(t.atr) : undefined,
      trailingStopPct:  t.trailing_stop_pct ? parseFloat(t.trailing_stop_pct) : undefined,
      takeProfitPrice:  t.take_profit_price ? parseFloat(t.take_profit_price) : undefined,
      stopLossPrice:    t.stop_loss_price ? parseFloat(t.stop_loss_price) : undefined,
      tier:             t.tier,
      llmSource:        t.llm_source,
    });
  }
  if (activePositions.size > 0) {
    console.log(`[Guardian v3.0] Synced ${activePositions.size} open position(s): ${[...activePositions.keys()].join(', ')}`);
    updateGuardianSubscriptions();
  }
}

export function hasOpenPosition(symbol: string): boolean {
  return activePositions.has(symbol);
}

export function getOpenPosition(symbol: string): ActivePosition | undefined {
  return activePositions.get(symbol);
}

export function getActivePositionsCount(): number {
  return activePositions.size;
}

export function getActivePositionsList(): ActivePosition[] {
  return Array.from(activePositions.values());
}

export function updatePositionStopLoss(symbol: string, newStopLoss: number): boolean {
  const pos = activePositions.get(symbol);
  if (!pos || pos.isClosing) return false;
  // Only allow tightening (for LONG: higher SL; for SHORT: lower SL)
  if (pos.positionSide === 'LONG') {
    if (!pos.stopLossPrice || newStopLoss > pos.stopLossPrice) {
      pos.stopLossPrice = newStopLoss;
      console.log(`[Guardian v3.4] 🛡️ Tightened Stop Loss for ${symbol} LONG -> $${newStopLoss.toFixed(4)}`);
      return true;
    }
  } else if (pos.positionSide === 'SHORT') {
    if (!pos.stopLossPrice || newStopLoss < pos.stopLossPrice) {
      pos.stopLossPrice = newStopLoss;
      console.log(`[Guardian v3.4] 🛡️ Tightened Stop Loss for ${symbol} SHORT -> $${newStopLoss.toFixed(4)}`);
      return true;
    }
  }
  return false;
}

export function registerPosition(params: {
  tradeId:          string;
  symbol:           string;
  positionSide:     'LONG' | 'SHORT';
  entryPrice:       number;
  amount:           number;
  atr?:             number;
  trailingStopPct?: number;
  takeProfitPrice?: number;
  stopLossPrice?:   number;
  tier?:            number;
  llmSource?:       string;
}) {
  activePositions.set(params.symbol, {
    ...params,
    openedAt:  Date.now(),
    peakPrice: params.entryPrice,
    isBreakevenSet: false,
  });
  console.log(`[Guardian v3.0] 📍 Registered: ${params.symbol} ${params.positionSide} @ $${params.entryPrice} | SL: $${params.stopLossPrice?.toFixed(4)} | TP: $${params.takeProfitPrice?.toFixed(4)}`);
  updateGuardianSubscriptions();
}

/** Called on every WebSocket tick — evaluates all open positions */
export async function onTick(tick: TickData) {
  const pos = activePositions.get(tick.symbol);
  if (!pos || pos.isClosing) return;

  const currentPrice = tick.lastPrice;
  const {
    LEVERAGE,
    FEE_RATE,
    MAX_HOLD_HOURS,
    STALE_HOLD_HOURS,
    STALE_PROFIT_THRESHOLD,
    BREAKEVEN_ATR_TRIGGER,
    TRAILING_STOP_ATR_MULT,
  } = RISK;

  // Update peak favorable price
  if (pos.positionSide === 'LONG'  && currentPrice > pos.peakPrice) pos.peakPrice = currentPrice;
  if (pos.positionSide === 'SHORT' && currentPrice < pos.peakPrice) pos.peakPrice = currentPrice;

  const minutesHeld = (Date.now() - pos.openedAt) / 60000;
  const hoursHeld   = minutesHeld / 60;

  const priceMovePct = pos.positionSide === 'LONG'
    ? (currentPrice - pos.entryPrice) / pos.entryPrice
    : (pos.entryPrice - currentPrice) / pos.entryPrice;

  const returnPct = priceMovePct * LEVERAGE;

  // ─── 1. STRUCTURAL / ATR STOP LOSS ──────────────────────────────────────────
  if (pos.stopLossPrice) {
    if (pos.positionSide === 'LONG' && currentPrice <= pos.stopLossPrice) {
      const exitTag = pos.isBreakevenSet ? 'BREAKEVEN_STOP' : 'STRUCTURAL_ATR_STOP';
      await closePosition(pos, currentPrice, `${exitTag}: Hit stop loss @ $${pos.stopLossPrice.toFixed(4)}`);
      return;
    } else if (pos.positionSide === 'SHORT' && currentPrice >= pos.stopLossPrice) {
      const exitTag = pos.isBreakevenSet ? 'BREAKEVEN_STOP' : 'STRUCTURAL_ATR_STOP';
      await closePosition(pos, currentPrice, `${exitTag}: Hit stop loss @ $${pos.stopLossPrice.toFixed(4)}`);
      return;
    }
  }

  // ─── 2. TAKE PROFIT TARGET ──────────────────────────────────────────────────
  if (pos.takeProfitPrice) {
    if (pos.positionSide === 'LONG' && currentPrice >= pos.takeProfitPrice) {
      await closePosition(pos, currentPrice, `TAKE_PROFIT: Reached dynamic target @ $${pos.takeProfitPrice.toFixed(4)} (+${(returnPct * 100).toFixed(1)}%)`);
      return;
    } else if (pos.positionSide === 'SHORT' && currentPrice <= pos.takeProfitPrice) {
      await closePosition(pos, currentPrice, `TAKE_PROFIT: Reached dynamic target @ $${pos.takeProfitPrice.toFixed(4)} (+${(returnPct * 100).toFixed(1)}%)`);
      return;
    }
  }

  // ─── 3. DYNAMIC BREAKEVEN STOP ACTIVATION (+Fee Buffer) ─────────────────────
  if (pos.atr && pos.atr > 0 && !pos.isBreakevenSet) {
    const profitDist = pos.positionSide === 'LONG'
      ? currentPrice - pos.entryPrice
      : pos.entryPrice - currentPrice;

    if (profitDist >= pos.atr * BREAKEVEN_ATR_TRIGGER) {
      const roundTripFeeBuffer = FEE_RATE * 2;
      const breakevenPrice = pos.positionSide === 'LONG'
        ? pos.entryPrice * (1 + roundTripFeeBuffer)
        : pos.entryPrice * (1 - roundTripFeeBuffer);

      pos.stopLossPrice = breakevenPrice;
      pos.isBreakevenSet = true;
      console.log(`[Guardian v3.0] 🛡️ ${pos.symbol} Breakeven Stop Activated @ $${breakevenPrice.toFixed(4)} (Risk-Free Trade)`);
    }
  }

  // ─── 4. ATR TRAILING STOP FOR RUNNERS ───────────────────────────────────────
  if (pos.atr && pos.atr > 0 && pos.isBreakevenSet) {
    const trailDist = pos.atr * TRAILING_STOP_ATR_MULT;
    if (pos.positionSide === 'LONG') {
      const candidateStop = pos.peakPrice - trailDist;
      if (candidateStop > (pos.stopLossPrice || 0)) {
        pos.stopLossPrice = candidateStop;
      }
    } else {
      const candidateStop = pos.peakPrice + trailDist;
      if (candidateStop < (pos.stopLossPrice || Infinity)) {
        pos.stopLossPrice = candidateStop;
      }
    }
  }

  // ─── 5. MAX HOLD TIME ───────────────────────────────────────────────────────
  if (hoursHeld >= MAX_HOLD_HOURS) {
    await closePosition(pos, currentPrice, `MAX_HOLD_TIME: ${hoursHeld.toFixed(1)}h elapsed`);
    return;
  }

  // ─── 6. STALE POSITION CONSOLIDATION EXIT ───────────────────────────────────
  if (hoursHeld >= STALE_HOLD_HOURS && Math.abs(priceMovePct) < STALE_PROFIT_THRESHOLD) {
    await closePosition(pos, currentPrice, `STALE_POSITION: Consolidating flat (${(returnPct * 100).toFixed(2)}%) after ${hoursHeld.toFixed(1)}h`);
    return;
  }
}

/** Close position in DB, adjust wallet balance, update Risk Governor, and log */
export async function closePosition(pos: ActivePosition, exitPrice: number, reason: string) {
  pos.isClosing = true;
  console.log(`\n🚨 [Guardian v3.0] EXIT for ${pos.symbol}: ${reason}`);

  const notionalEntry = pos.amount * pos.entryPrice;
  const notionalExit  = pos.amount * exitPrice;
  const grossPnl = pos.positionSide === 'LONG'
    ? (exitPrice - pos.entryPrice) * pos.amount
    : (pos.entryPrice - exitPrice) * pos.amount;

  const totalFees = (notionalEntry + notionalExit) * RISK.FEE_RATE;
  const netPnl = parseFloat((grossPnl - totalFees).toFixed(4));
  const marginAllocated = notionalEntry / RISK.LEVERAGE;
  const returnPct = parseFloat(((netPnl / marginAllocated) * 100).toFixed(2));
  const isWin = netPnl > 0;

  try {
    await updateFuturesTrade(pos.tradeId, {
      status:       'CLOSED',
      exit_price:   exitPrice,
      realized_pnl: netPnl,
      closed_at:    new Date().toISOString(),
      exit_reason:  reason,
      fee:          parseFloat(totalFees.toFixed(4)),
      return_pct:   returnPct,
    });

    await adjustWalletBalanceAtomic(netPnl);
    const newBal = await fetchWalletBalance().catch(() => 0);

    // Record trade outcome in Risk Governor (streak & drawdown tracking)
    riskGovernor.recordTradeOutcome(pos.symbol, netPnl, isWin);

    console.log(`[Guardian v3.0] ✅ ${pos.symbol} ${pos.positionSide} CLOSED | Entry: $${pos.entryPrice} → Exit: $${exitPrice} | Net PnL: $${netPnl} | New Balance: $${newBal.toFixed(2)}`);

    await logFocusEvent({
      event_type: 'TRADE_EXIT',
      symbol:     pos.symbol,
      action:     'CLOSE',
      message:    `${pos.positionSide} closed @ $${exitPrice}. PnL: $${netPnl} (${returnPct}%). Reason: ${reason}`,
    });

    activePositions.delete(pos.symbol);
    updateGuardianSubscriptions();

    // Trigger engine status update with refreshed metrics
    updateEngineStatus({ active_trades_count: activePositions.size }).catch(() => {});
  } catch (err: any) {
    console.error(`[Guardian] Error closing position: ${err.message}`);
    pos.isClosing = false;
  }
}

/** Clear all active positions from in-memory map and unsubscribe WS */
export function clearActivePositionsInMemory(): void {
  console.log(`[Guardian] 🧹 Clearing ${activePositions.size} in-memory active position(s)...`);
  activePositions.clear();
  subscribedSymbols.clear();
  updateGuardianSubscriptions();
}

