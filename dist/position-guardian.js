"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.displayActiveTrades = displayActiveTrades;
exports.syncOpenPositions = syncOpenPositions;
exports.hasOpenPosition = hasOpenPosition;
exports.getOpenPosition = getOpenPosition;
exports.getActivePositionsCount = getActivePositionsCount;
exports.registerPosition = registerPosition;
exports.onTick = onTick;
exports.closePosition = closePosition;
/**
 * position-guardian.ts
 * High-precision position guardian with ATR dynamic trailing stops, risk-managed exits, and telemetry.
 */
const config_1 = require("./config");
const supabase_logger_1 = require("./supabase-logger");
const ws_1 = __importDefault(require("ws"));
const activePositions = new Map();
let guardianWs = null;
let guardianPingTimer = null;
const subscribedSymbols = new Set();
function startGuardianWs() {
    if (guardianWs && guardianWs.readyState === ws_1.default.OPEN)
        return;
    console.log(`[Guardian] Connecting to Bitget WS to monitor active positions...`);
    guardianWs = new ws_1.default('wss://ws.bitget.com/v2/ws/public');
    guardianWs.on('open', () => {
        console.log(`[Guardian] ✅ Connected to Bitget WS. Actively monitoring ticks for open positions.`);
        guardianPingTimer = setInterval(() => {
            if (guardianWs?.readyState === ws_1.default.OPEN)
                guardianWs.send('ping');
        }, 20000);
        updateGuardianSubscriptions();
    });
    guardianWs.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.event === 'subscribe')
                return;
            if (msg.data && msg.arg?.channel === 'ticker') {
                const data = msg.data[0];
                const tick = {
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
        }
        catch { /* ignore malformed */ }
    });
    guardianWs.on('close', () => {
        if (guardianPingTimer)
            clearInterval(guardianPingTimer);
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
    if (!guardianWs || guardianWs.readyState !== ws_1.default.OPEN) {
        if (activePositions.size > 0)
            startGuardianWs();
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
function displayActiveTrades() {
    console.log(`\n================= 📊 LIVE ACTIVE TRADES 📊 =================`);
    if (activePositions.size === 0) {
        console.log(`  No open trades currently.`);
    }
    else {
        for (const [sym, pos] of activePositions.entries()) {
            console.log(`  ➤ ${sym} [${pos.positionSide}] | Entry: $${pos.entryPrice.toFixed(4)} | Size: ${pos.amount.toFixed(2)} | ATR: ${pos.atr?.toFixed(4) || 'N/A'}`);
        }
    }
    console.log(`============================================================\n`);
}
async function syncOpenPositions() {
    const trades = await (0, supabase_logger_1.fetchOpenFuturesTrades)();
    activePositions.clear();
    for (const t of trades) {
        activePositions.set(t.symbol, {
            tradeId: t.id,
            symbol: t.symbol,
            positionSide: t.position_side,
            entryPrice: parseFloat(t.entry_price),
            amount: parseFloat(t.amount),
            openedAt: new Date(t.created_at).getTime(),
            peakPrice: parseFloat(t.entry_price),
            atr: t.atr ? parseFloat(t.atr) : undefined,
            trailingStopPct: t.trailing_stop_pct ? parseFloat(t.trailing_stop_pct) : undefined,
            takeProfitPrice: t.take_profit_price ? parseFloat(t.take_profit_price) : undefined,
            stopLossPrice: t.stop_loss_price ? parseFloat(t.stop_loss_price) : undefined,
            tier: t.tier,
            llmSource: t.llm_source,
        });
    }
    if (activePositions.size > 0) {
        console.log(`[Guardian] Synced ${activePositions.size} open position(s): ${[...activePositions.keys()].join(', ')}`);
        updateGuardianSubscriptions();
    }
}
function hasOpenPosition(symbol) {
    return activePositions.has(symbol);
}
function getOpenPosition(symbol) {
    return activePositions.get(symbol);
}
function getActivePositionsCount() {
    return activePositions.size;
}
function registerPosition(params) {
    activePositions.set(params.symbol, {
        ...params,
        openedAt: Date.now(),
        peakPrice: params.entryPrice,
    });
    console.log(`[Guardian] 📍 Registered: ${params.symbol} ${params.positionSide} @ $${params.entryPrice}`);
    updateGuardianSubscriptions();
}
/** Called on every WebSocket tick — evaluates all open positions */
async function onTick(tick) {
    const pos = activePositions.get(tick.symbol);
    if (!pos || pos.isClosing)
        return;
    const currentPrice = tick.lastPrice;
    const { LEVERAGE, TAKE_PROFIT_PCT, TRAILING_STOP_PCT, MAX_LOSS_PCT, FEE_RATE, MIN_HOLD_MINUTES, MAX_HOLD_HOURS, STALE_HOLD_HOURS, STALE_PROFIT_THRESHOLD, USE_ATR_STOP, ATR_MULTIPLIER, } = config_1.RISK;
    // Update peak price
    if (pos.positionSide === 'LONG' && currentPrice > pos.peakPrice)
        pos.peakPrice = currentPrice;
    if (pos.positionSide === 'SHORT' && currentPrice < pos.peakPrice)
        pos.peakPrice = currentPrice;
    const minutesHeld = (Date.now() - pos.openedAt) / 60000;
    const hoursHeld = minutesHeld / 60;
    const isHoldMet = minutesHeld >= MIN_HOLD_MINUTES;
    // Raw price change percentage (unleveraged)
    const priceMovePct = pos.positionSide === 'LONG'
        ? (currentPrice - pos.entryPrice) / pos.entryPrice
        : (pos.entryPrice - currentPrice) / pos.entryPrice;
    // Leveraged return percentage
    const returnPct = priceMovePct * LEVERAGE;
    // ─── 1. HARD STOP LOSS (Always active regardless of hold time) ───────────────
    if (returnPct <= -MAX_LOSS_PCT) {
        await closePosition(pos, currentPrice, `MAX_LOSS: Hit hard stop at ${(returnPct * 100).toFixed(2)}%`);
        return;
    }
    // ─── 2. ATR / TRAILING STOP (Protects profits once in the green) ──────────────
    let isTrailingStopHit = false;
    let trailReason = '';
    if (USE_ATR_STOP && pos.atr && pos.atr > 0) {
        const atrDist = pos.atr * ATR_MULTIPLIER;
        if (pos.positionSide === 'LONG') {
            const trailStopPrice = pos.peakPrice - atrDist;
            if (currentPrice <= trailStopPrice && pos.peakPrice > pos.entryPrice) {
                isTrailingStopHit = true;
                trailReason = `ATR_TRAILING_STOP: Price dipped below stop $${trailStopPrice.toFixed(4)} (ATR: ${pos.atr.toFixed(4)})`;
            }
        }
        else {
            const trailStopPrice = pos.peakPrice + atrDist;
            if (currentPrice >= trailStopPrice && pos.peakPrice < pos.entryPrice) {
                isTrailingStopHit = true;
                trailReason = `ATR_TRAILING_STOP: Price rallied above stop $${trailStopPrice.toFixed(4)} (ATR: ${pos.atr.toFixed(4)})`;
            }
        }
    }
    else {
        // Percentage-based trailing stop on price retrace from peak
        const peakGain = pos.positionSide === 'LONG'
            ? (pos.peakPrice - pos.entryPrice) / pos.entryPrice
            : (pos.entryPrice - pos.peakPrice) / pos.entryPrice;
        if (peakGain >= 0.015) { // Only trail once gain > 1.5%
            const retraceFromPeak = pos.positionSide === 'LONG'
                ? (pos.peakPrice - currentPrice) / pos.peakPrice
                : (currentPrice - pos.peakPrice) / pos.peakPrice;
            if (retraceFromPeak >= (pos.trailingStopPct || TRAILING_STOP_PCT)) {
                isTrailingStopHit = true;
                trailReason = `TRAILING_STOP: ${(retraceFromPeak * 100).toFixed(2)}% retrace from peak $${pos.peakPrice.toFixed(4)}`;
            }
        }
    }
    if (isTrailingStopHit) {
        await closePosition(pos, currentPrice, trailReason);
        return;
    }
    // If min hold time is not yet met, keep trade open unless stopped out above
    if (!isHoldMet)
        return;
    // ─── 3. TAKE PROFIT TARGET ───────────────────────────────────────────────────
    if (returnPct >= TAKE_PROFIT_PCT) {
        await closePosition(pos, currentPrice, `TAKE_PROFIT: Reached target +${(returnPct * 100).toFixed(2)}%`);
        return;
    }
    // ─── 4. MAX HOLD DURATION ────────────────────────────────────────────────────
    if (hoursHeld >= MAX_HOLD_HOURS) {
        await closePosition(pos, currentPrice, `MAX_HOLD_TIME: ${hoursHeld.toFixed(2)}h elapsed`);
        return;
    }
    // ─── 5. STALE POSITION EXIT ──────────────────────────────────────────────────
    if (hoursHeld >= STALE_HOLD_HOURS && Math.abs(returnPct) < STALE_PROFIT_THRESHOLD) {
        await closePosition(pos, currentPrice, `STALE_POSITION: Consolidating flat (${(returnPct * 100).toFixed(2)}%) after ${hoursHeld.toFixed(2)}h`);
        return;
    }
}
/** Close position in DB, adjust wallet balance, and update subscriptions */
async function closePosition(pos, exitPrice, reason) {
    pos.isClosing = true;
    console.log(`\n🚨 [Guardian] EXIT for ${pos.symbol}: ${reason}`);
    const notionalEntry = pos.amount * pos.entryPrice;
    const notionalExit = pos.amount * exitPrice;
    const grossPnl = pos.positionSide === 'LONG'
        ? (exitPrice - pos.entryPrice) * pos.amount
        : (pos.entryPrice - exitPrice) * pos.amount;
    const totalFees = (notionalEntry + notionalExit) * config_1.RISK.FEE_RATE;
    const netPnl = parseFloat((grossPnl - totalFees).toFixed(4));
    const returnPct = parseFloat(((netPnl / (notionalEntry / config_1.RISK.LEVERAGE)) * 100).toFixed(2));
    try {
        await (0, supabase_logger_1.updateFuturesTrade)(pos.tradeId, {
            status: 'CLOSED',
            exit_price: exitPrice,
            realized_pnl: netPnl,
            closed_at: new Date().toISOString(),
            exit_reason: reason,
            fee: parseFloat(totalFees.toFixed(4)),
            return_pct: returnPct,
        });
        await (0, supabase_logger_1.adjustWalletBalanceAtomic)(netPnl);
        const newBal = await (0, supabase_logger_1.fetchWalletBalance)().catch(() => 0);
        console.log(`[Guardian] ✅ ${pos.symbol} ${pos.positionSide} CLOSED | Entry: $${pos.entryPrice} → Exit: $${exitPrice} | Net PnL: $${netPnl} | New Balance: $${newBal.toFixed(2)}`);
        await (0, supabase_logger_1.logFocusEvent)({
            event_type: 'TRADE_EXIT',
            symbol: pos.symbol,
            action: 'CLOSE',
            message: `${pos.positionSide} closed @ $${exitPrice}. PnL: $${netPnl} (${returnPct}%). Reason: ${reason}`,
        });
        activePositions.delete(pos.symbol);
        updateGuardianSubscriptions();
        // Trigger engine status update with refreshed metrics
        (0, supabase_logger_1.updateEngineStatus)({ active_trades_count: activePositions.size }).catch(() => { });
    }
    catch (err) {
        console.error(`[Guardian] Error closing position: ${err.message}`);
        pos.isClosing = false;
    }
}
//# sourceMappingURL=position-guardian.js.map