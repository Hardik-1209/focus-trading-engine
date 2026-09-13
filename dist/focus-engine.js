"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFocusEngine = runFocusEngine;
/**
 * focus-engine.ts (v3.0)
 * Quantitative 15m/5m Multi-Timeframe Focus Orchestrator with Adversarial Groq Risk Auditor,
 * Risk Governor Circuit Breakers, and Dynamic Triple Barrier Geometry.
 */
const coin_selector_1 = require("./coin-selector");
const bitget_ws_1 = require("./bitget-ws");
const signal_detector_1 = require("./signal-detector");
const llm_router_1 = require("./llm-router");
const risk_governor_1 = require("./risk-governor");
const position_guardian_1 = require("./position-guardian");
const supabase_logger_1 = require("./supabase-logger");
const server_1 = require("./server");
const config_1 = require("./config");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastSignalTime = new Map();
let analysisInProgress = false;
/** Watch a single coin on 15m/5m candles until trade closes, timeout, or chop exit */
async function watchCoin(symbol, cycleNumber, fundingRate) {
    console.log(`\n${'═'.repeat(65)}`);
    console.log(`👁  FOCUS v3.0: ${symbol} | Max watch: ${config_1.CONFIG.WATCH_DURATION_MS / 60000} min (Cycle #${cycleNumber})`);
    console.log(`${'═'.repeat(65)}\n`);
    (0, server_1.setServerFocusedCoin)(symbol, cycleNumber);
    (0, supabase_logger_1.updateEngineStatus)({
        focused_symbol: symbol,
        cycle_count: cycleNumber,
        active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
        is_running: true,
    }).catch(() => { });
    // 1. Bootstrap 5m & 15m historical candles
    let bootstrapCandles5m = [];
    let bootstrapCandles15m = [];
    try {
        const [c5m, c15m] = await Promise.all([
            (0, coin_selector_1.fetchBootstrapCandles)(symbol, 60, '5m'),
            (0, coin_selector_1.fetchBootstrapCandles)(symbol, 40, '15m'),
        ]);
        bootstrapCandles5m = c5m;
        bootstrapCandles15m = c15m;
        console.log(`[Engine v3.0] Bootstrapped ${bootstrapCandles5m.length} x 5m and ${bootstrapCandles15m.length} x 15m candles`);
    }
    catch (err) {
        console.warn(`[Engine] Bootstrap warning: ${err.message}. Initializing empty buffers.`);
    }
    // 2. Connect WebSocket
    const ws = new bitget_ws_1.BitgetWS(symbol);
    ws.seedCandles(bootstrapCandles5m, '5m');
    ws.seedCandles(bootstrapCandles15m, '15m');
    (0, supabase_logger_1.updateEngineStatus)({
        focused_symbol: symbol,
        cycle_count: cycleNumber,
        active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
        live_indicators: {
            price: bootstrapCandles5m[bootstrapCandles5m.length - 1]?.close || 0,
            timestamp: new Date().toISOString(),
        },
    }).catch(() => { });
    let tradeOpened = false;
    let lastLoggedBar = 0;
    let stagnantCandlesCount = 0;
    // 3. Candle 5m close event — run quantitative 15m/5m signal detection
    ws.on('candle5m', async (latestCandle, allCandles5m, allCandles15m) => {
        if (analysisInProgress)
            return;
        if (tradeOpened && !(0, position_guardian_1.hasOpenPosition)(symbol))
            return;
        if ((0, position_guardian_1.hasOpenPosition)(symbol))
            return;
        // Check Risk Governor circuit breaker
        const govCheck = risk_governor_1.riskGovernor.canTradeSymbol(symbol);
        if (!govCheck.allowed) {
            console.warn(`[Engine v3.0] Symbol ${symbol} blocked by Risk Governor: ${govCheck.reason}`);
            return;
        }
        // Cooldown check
        const lastSig = lastSignalTime.get(symbol) || 0;
        if (Date.now() - lastSig < config_1.SIGNAL.SIGNAL_COOLDOWN_MS)
            return;
        // Run multi-timeframe signal detection
        const signal = (0, signal_detector_1.detectSignal)(allCandles5m, latestCandle.close, allCandles15m);
        // Broadcast live telemetry
        (0, supabase_logger_1.updateEngineStatus)({
            focused_symbol: symbol,
            cycle_count: cycleNumber,
            active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
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
        }).catch(() => { });
        if (signal.action === 'WAIT') {
            if (signal.regime === 'VOLATILE_CHOP' || signal.regime === 'RANGING') {
                stagnantCandlesCount++;
            }
            else {
                stagnantCandlesCount = 0;
            }
            if (latestCandle.timestamp !== lastLoggedBar) {
                console.log(`[Engine v3.0] ⏳ ${signal.reason}`);
                lastLoggedBar = latestCandle.timestamp;
                await (0, supabase_logger_1.logFocusEvent)({
                    event_type: 'SYSTEM_PING',
                    symbol,
                    action: 'WAIT',
                    indicators: signal.indicators,
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
            const verdict = await (0, llm_router_1.evaluateRiskVerdict)({
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
            await (0, supabase_logger_1.logMarketSignal)({
                symbol,
                action: signal.action,
                tier: 2,
                approved,
                llm_source: verdict.llmSource,
                confidence: verdict.confidence,
                indicators: signal.indicators,
                reason: `${signal.reason} | CRO Verdict: ${verdict.verdict} (${verdict.reasoning})`,
            });
            if (approved) {
                console.log(`[Engine v3.0] 🎯 CRO AUDIT PASSED: Executing ${signal.action} trade!`);
                await executeTrade(symbol, signal.action, latestCandle.close, signal.stopLossPrice, signal.takeProfitPrice, signal.atr, signal.plannedRR, verdict.llmSource, llmReasoning, signal.indicators);
                tradeOpened = true;
            }
            else {
                console.log(`[Engine v3.0] ❌ Trade VETOED by CRO (${verdict.reasoning}). Capital protected.`);
            }
        }
        catch (err) {
            console.error(`[Engine v3.0] Analysis error: ${err.message}`);
        }
        finally {
            analysisInProgress = false;
        }
    });
    ws.connect();
    // 5. Watch loop
    const watchUntil = Date.now() + config_1.CONFIG.WATCH_DURATION_MS;
    const minWatchUntil = Date.now() + 180000; // Allow at least 3 minutes
    while (Date.now() < watchUntil) {
        if (tradeOpened && !(0, position_guardian_1.hasOpenPosition)(symbol)) {
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
async function executeTrade(symbol, side, entryPrice, stopLossPrice, takeProfitPrice, atr, plannedRR, llmSource, aiReasoning, indicatorsAtEntry = {}) {
    if (await (0, supabase_logger_1.checkRecentTrade)(symbol)) {
        console.warn(`[Engine v3.0] Idempotency guard: trade for ${symbol} placed recently. Skipping.`);
        return;
    }
    const wallet = await (0, supabase_logger_1.fetchWalletBalance)();
    const margin = config_1.RISK.MARGIN_PER_TRADE; // Flat $1.00 margin per trade
    const posSize = margin * config_1.RISK.LEVERAGE; // $3.00 notional at 3x leverage
    const amount = posSize / entryPrice;
    console.log(`\n💰 [Engine v3.0] OPENING ${side} on ${symbol}`);
    console.log(`   Wallet: $${wallet.toFixed(2)} | Margin: $${margin.toFixed(2)} | Notional: $${posSize.toFixed(2)} (${config_1.RISK.LEVERAGE}x)`);
    console.log(`   Entry: $${entryPrice} | SL: $${stopLossPrice.toFixed(4)} | TP: $${takeProfitPrice.toFixed(4)} | Planned R:R: ${plannedRR}:1`);
    if (config_1.CONFIG.DRY_RUN) {
        console.log(`[Engine v3.0] [DRY RUN] Simulating ${side} trade for ${symbol}`);
        const tradeId = await (0, supabase_logger_1.insertFuturesTrade)({
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
            trailing_stop_pct: config_1.RISK.TRAILING_STOP_ATR_MULT,
        });
        (0, position_guardian_1.registerPosition)({
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
        await (0, supabase_logger_1.logFocusEvent)({
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
async function runFocusEngine() {
    console.log('\n🤖 Focus Trading Engine v3.0 starting...');
    await (0, position_guardian_1.syncOpenPositions)();
    // Initialize Risk Governor starting balance
    const initialWallet = await (0, supabase_logger_1.fetchWalletBalance)().catch(() => 10.00);
    risk_governor_1.riskGovernor.setStartingBalance(initialWallet);
    while (true) {
        const cycleCount = await (0, supabase_logger_1.fetchCurrentEngineCycle)();
        console.log(`\n[Engine v3.0] ━━━ Cycle #${cycleCount} ━━━`);
        (0, position_guardian_1.displayActiveTrades)();
        const govStatus = risk_governor_1.riskGovernor.getStatus();
        if (govStatus.dailyHalted) {
            console.warn(`[Engine v3.0] 🛑 DAILY DRAWDOWN KILL SWITCH ACTIVE. Waiting 60s for next UTC day...`);
            await sleep(60000);
            continue;
        }
        try {
            await (0, supabase_logger_1.updateEngineStatus)({
                focused_symbol: 'Scanning market (v3.0)...',
                cycle_count: cycleCount,
                active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
            }).catch(() => { });
            const coin = await (0, coin_selector_1.selectHottestCoin)();
            const result = await watchCoin(coin.symbol, cycleCount, coin.fundingRate);
            const nextCycle = cycleCount + 1;
            await (0, supabase_logger_1.updateEngineStatus)({
                cycle_count: nextCycle,
                active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
            }).catch(() => { });
            await (0, supabase_logger_1.logHealth)({
                event_type: 'COIN_ROTATED',
                component: 'focus-engine',
                severity: 'INFO',
                message: `Cycle #${cycleCount} finished on ${coin.symbol}. Result: ${result}. Rotating.`,
            });
            console.log(`\n[Engine v3.0] Rotation complete (${result}). Inter-cycle pause...`);
            await sleep(3000);
        }
        catch (err) {
            console.error(`[Engine v3.0] Cycle error: ${err.message}`);
            await (0, supabase_logger_1.logHealth)({
                event_type: 'CYCLE_ERROR',
                component: 'focus-engine',
                severity: 'ERROR',
                message: err.message,
            });
            await sleep(15000);
        }
    }
}
//# sourceMappingURL=focus-engine.js.map