"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFocusEngine = runFocusEngine;
/**
 * focus-engine.ts
 * Quantitative 30-min Focus Orchestrator with Multi-Timeframe Confirmation (1m + 5m),
 * Groq Cloud LLM Validation, and ATR Volatility Targets.
 */
const coin_selector_1 = require("./coin-selector");
const bitget_ws_1 = require("./bitget-ws");
const signal_detector_1 = require("./signal-detector");
const llm_router_1 = require("./llm-router");
const position_guardian_1 = require("./position-guardian");
const supabase_logger_1 = require("./supabase-logger");
const server_1 = require("./server");
const config_1 = require("./config");
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const lastSignalTime = new Map();
let analysisInProgress = false;
/** Watch a single coin for up to WATCH_DURATION_MS or until a trade closes */
async function watchCoin(symbol, cycleNumber) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`👁  FOCUS: ${symbol} | Max watch: ${config_1.CONFIG.WATCH_DURATION_MS / 60000} min (Cycle #${cycleNumber})`);
    console.log(`${'═'.repeat(60)}\n`);
    (0, server_1.setServerFocusedCoin)(symbol, cycleNumber);
    (0, supabase_logger_1.updateEngineStatus)({
        focused_symbol: symbol,
        cycle_count: cycleNumber,
        active_trades_count: (0, position_guardian_1.getActivePositionsCount)(),
        is_running: true,
    }).catch(() => { });
    // 1. Bootstrap 1m & 5m historical candles
    let bootstrapCandles1m = [];
    let bootstrapCandles5m = [];
    try {
        const [c1m, c5m] = await Promise.all([
            (0, coin_selector_1.fetchBootstrapCandles)(symbol, 60, '1m'),
            (0, coin_selector_1.fetchBootstrapCandles)(symbol, 40, '5m'),
        ]);
        bootstrapCandles1m = c1m;
        bootstrapCandles5m = c5m;
        console.log(`[Engine] Bootstrapped ${bootstrapCandles1m.length} x 1m and ${bootstrapCandles5m.length} x 5m candles`);
    }
    catch (err) {
        console.warn(`[Engine] Bootstrap warning: ${err.message}. Initializing empty buffer.`);
    }
    // 2. Connect WebSocket
    const ws = new bitget_ws_1.BitgetWS(symbol);
    ws.seedCandles(bootstrapCandles1m, '1m');
    ws.seedCandles(bootstrapCandles5m, '5m');
    let tradeClosedSignal = false;
    let tradeOpened = false;
    let lastLoggedMinute = 0;
    ws.on('tick', (_tick) => {
        // Ticks are also monitored globally by position-guardian.ts
    });
    // 3. Candle 1m close event — run quantitative signal detection
    ws.on('candle1m', async (latestCandle, allCandles) => {
        if (tradeClosedSignal || analysisInProgress)
            return;
        if (tradeOpened && !(0, position_guardian_1.hasOpenPosition)(symbol))
            return;
        // Don't seek new entries if already holding this symbol
        if ((0, position_guardian_1.hasOpenPosition)(symbol))
            return;
        // Signal cooldown check
        const lastSig = lastSignalTime.get(symbol) || 0;
        if (Date.now() - lastSig < config_1.SIGNAL.SIGNAL_COOLDOWN_MS)
            return;
        // Detect signal with 5m multi-timeframe confirmation
        const signal = (0, signal_detector_1.detectSignal)(allCandles, latestCandle.close, ws.candles5m);
        if (signal.action === 'WAIT') {
            if (latestCandle.timestamp !== lastLoggedMinute) {
                console.log(`[Engine] ⏳ ${signal.reason}`);
                lastLoggedMinute = latestCandle.timestamp;
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
        console.log(`\n[Engine] 🔔 Signal detected! ${signal.action} (Tier ${signal.tier})`);
        console.log(`[Engine] ${signal.reason}`);
        lastSignalTime.set(symbol, Date.now());
        analysisInProgress = true;
        try {
            let finalAction = signal.action;
            let llmSource = 'rule-based';
            let confidenceScore = 80;
            // Tier 2 — validate with Groq Cloud LLM
            if (!signal.skipLLM) {
                console.log(`[Engine] 🤖 Tier 2 edge-case signal — requesting Groq Cloud LLM verification...`);
                const description = `5M_Trend=${signal.indicators.mtfTrend}, RSI=${signal.indicators.rsi.toFixed(1)}, ` +
                    `ADX=${signal.indicators.adx.toFixed(1)}, ATR=${signal.indicators.atr.toFixed(4)}, ` +
                    `MACD_hist=${signal.indicators.macdHist.toFixed(6)}, Price>EMA=${signal.indicators.emaCrossover}, ` +
                    `VolZ=${signal.indicators.volumeZ.toFixed(2)}, Price=$${latestCandle.close}`;
                const narrative = await (0, llm_router_1.evaluateNarrative)(symbol, description);
                llmSource = narrative.llmSource;
                confidenceScore = narrative.confidence_score;
                console.log(`[Engine] Narrative (${narrative.llmSource}): ${narrative.narrative_category} (Score: ${narrative.confidence_score}/100)`);
                const verdict = await (0, llm_router_1.evaluateRiskVerdict)({
                    symbol,
                    auditBlock: { isScam: false, scamRiskScore: 2, flags: [], details: 'Audited' },
                    technicalBlock: {
                        emaCrossover: signal.indicators.emaCrossover,
                        latestEMA: signal.indicators.latestEMA,
                        latestADX: signal.indicators.adx,
                        latestZScore: signal.indicators.volumeZ,
                        latestRSI: signal.indicators.rsi,
                        rsiOversold: signal.indicators.rsi < 30,
                        rsiOverbought: signal.indicators.rsi > 70,
                        macdBullish: signal.indicators.macdBullish,
                        macdBearish: signal.indicators.macdBearish,
                        macdCrossUp: signal.indicators.emaCrossover && signal.indicators.macdBullish,
                        macdCrossDown: !signal.indicators.emaCrossover && signal.indicators.macdBearish,
                        latestHistogram: signal.indicators.macdHist,
                    },
                    narrativeBlock: {
                        narrativeCategory: narrative.narrative_category,
                        confidenceScore: narrative.confidence_score,
                        reasoning: narrative.reasoning,
                    },
                    macroRegime: 'RISK_ON',
                    isMacroHostile: false,
                });
                finalAction = verdict.verdict;
                console.log(`[Engine] LLM verdict (${verdict.llmSource}): ${finalAction} — ${verdict.reasoning}`);
                await (0, supabase_logger_1.logFocusEvent)({
                    event_type: 'LLM_EVALUATION',
                    symbol,
                    tier: signal.tier,
                    llm_source: `${verdict.llmSource}: ${verdict.reasoning}`,
                    action: finalAction,
                    indicators: signal.indicators,
                    message: `Groq Verdict: ${finalAction}`,
                });
            }
            // Audit signal to database
            await (0, supabase_logger_1.logMarketSignal)({
                symbol,
                action: signal.action,
                tier: signal.tier,
                approved: finalAction === 'LONG' || finalAction === 'SHORT',
                llm_source: llmSource,
                confidence: confidenceScore,
                indicators: signal.indicators,
                reason: signal.reason,
            });
            // Execute trade if approved
            if (finalAction === 'LONG' || finalAction === 'SHORT') {
                await executeTrade(symbol, finalAction, latestCandle.close, signal.tier, llmSource, signal.indicators.atr);
                tradeOpened = true;
            }
            else {
                console.log(`[Engine] ❌ Trade skipped (${finalAction}). Continuing observation.`);
            }
        }
        catch (err) {
            console.error(`[Engine] Analysis error: ${err.message}`);
        }
        finally {
            analysisInProgress = false;
        }
    });
    ws.connect();
    // 4. Wait until rotation timeout or trade completes
    const watchUntil = Date.now() + config_1.CONFIG.WATCH_DURATION_MS;
    while (Date.now() < watchUntil) {
        if (tradeClosedSignal) {
            ws.disconnect();
            return 'trade_closed';
        }
        if (tradeOpened && !(0, position_guardian_1.hasOpenPosition)(symbol)) {
            console.log(`[Engine] 🏁 Trade for ${symbol} was closed by Guardian. Rotating to next volatile coin...`);
            ws.disconnect();
            return 'trade_closed';
        }
        await sleep(1000);
    }
    ws.disconnect();
    return tradeOpened ? 'no_trade' : 'no_trade';
}
async function executeTrade(symbol, side, price, tier, llmSource, atr = price * 0.015) {
    if (await (0, supabase_logger_1.checkRecentTrade)(symbol)) {
        console.warn(`[Engine] Idempotency guard: trade for ${symbol} placed in last 30s. Skipping.`);
        return;
    }
    const wallet = await (0, supabase_logger_1.fetchWalletBalance)();
    const margin = 1.00; // Flat $1 margin per trade
    const posSize = margin * config_1.RISK.LEVERAGE;
    const amount = posSize / price;
    // Calculate ATR-based targets
    const takeProfitPrice = side === 'LONG' ? price + (atr * 3.5) : price - (atr * 3.5);
    const stopLossPrice = side === 'LONG' ? price - (atr * 2.0) : price + (atr * 2.0);
    console.log(`\n💰 [Engine] OPENING ${side} on ${symbol}`);
    console.log(`   Wallet: $${wallet.toFixed(2)} | Margin: $${margin.toFixed(2)} | Pos: $${posSize.toFixed(2)} | Amount: ${amount.toFixed(6)}`);
    console.log(`   Entry: $${price} | ATR: ${atr.toFixed(4)} | TP: $${takeProfitPrice.toFixed(4)} | SL: $${stopLossPrice.toFixed(4)}`);
    console.log(`   Tier: ${tier} | LLM: ${llmSource}`);
    if (config_1.CONFIG.DRY_RUN) {
        console.log(`[Engine] [DRY RUN] Simulating ${side} trade for ${symbol}`);
        const tradeId = await (0, supabase_logger_1.insertFuturesTrade)({
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
            trailing_stop_pct: config_1.RISK.TRAILING_STOP_PCT,
        });
        (0, position_guardian_1.registerPosition)({
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
        await (0, supabase_logger_1.logFocusEvent)({
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
async function runFocusEngine() {
    console.log('\n🤖 Focus Trading Engine starting...');
    await (0, position_guardian_1.syncOpenPositions)();
    let cycleCount = 0;
    while (true) {
        cycleCount++;
        console.log(`\n[Engine] ━━━ Cycle #${cycleCount} ━━━`);
        (0, position_guardian_1.displayActiveTrades)();
        try {
            const coin = await (0, coin_selector_1.selectHottestCoin)();
            const result = await watchCoin(coin.symbol, cycleCount);
            await (0, supabase_logger_1.logHealth)({
                event_type: 'COIN_ROTATED',
                component: 'focus-engine',
                severity: 'INFO',
                message: `Cycle #${cycleCount} finished on ${coin.symbol}. Result: ${result}. Rotating.`,
            });
            console.log(`\n[Engine] Rotation complete (${result}). Brief pause before next coin...`);
            await sleep(5000);
        }
        catch (err) {
            console.error(`[Engine] Cycle error: ${err.message}`);
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