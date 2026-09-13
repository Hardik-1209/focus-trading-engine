import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface Trade {
  id: string;
  symbol: string;
  position_side: string;
  amount: number;
  entry_price: number;
  exit_price: number;
  realized_pnl: number;
  fee: number;
  return_pct: number;
  status: string;
  created_at: string;
  closed_at: string;
  exit_reason: string;
  ai_reasoning: string;
  indicators_at_entry?: any;
}

interface AnalysisData {
  summary: any;
  status: any;
  trades: Trade[];
}

const rawData = fs.readFileSync('scripts/trades_dump.json', 'utf8');
const data: AnalysisData = JSON.parse(rawData);
const { summary, trades } = data;

// Create PDF with custom styling
const outputPath = path.resolve(__dirname, '..', 'Focus_Trading_Engine_24H_Report.pdf');
const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 40, right: 40 },
  bufferPages: true,
  autoFirstPage: true
});

const writeStream = fs.createWriteStream(outputPath);
doc.pipe(writeStream);

// Colors
const C = {
  primary: '#0f172a',      // Slate 900
  secondary: '#1e293b',    // Slate 800
  accent: '#2563eb',       // Blue 600
  accentLight: '#eff6ff',  // Blue 50
  win: '#16a34a',          // Green 600
  winBg: '#f0fdf4',        // Green 50
  loss: '#dc2626',         // Red 600
  lossBg: '#fef2f2',       // Red 50
  text: '#334155',         // Slate 700
  textDark: '#0f172a',     // Slate 900
  textMuted: '#64748b',    // Slate 500
  border: '#cbd5e1',       // Slate 300
  borderLight: '#e2e8f0',  // Slate 200
  cardBg: '#f8fafc',       // Slate 50
};

// Helper functions
function drawHeader(title: string, category = 'SYSTEM AUDIT & REPORT') {
  doc.fontSize(8).fillColor(C.accent).font('Helvetica-Bold').text(category.toUpperCase(), { characterSpacing: 1 });
  doc.fontSize(18).fillColor(C.primary).font('Helvetica-Bold').text(title);
  doc.moveDown(0.3);
  doc.strokeColor(C.border).lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);
}

function checkPageSpace(requiredSpace: number) {
  if (doc.y + requiredSpace > 780) {
    doc.addPage();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 1: TITLE & EXECUTIVE SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

// Title Block
doc.rect(40, 40, 515, 90).fill(C.primary);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('FOCUS TRADING ENGINE v2.0', 60, 55);
doc.fillColor('#94a3b8').font('Helvetica').fontSize(11).text('24-Hour Simulation Audit, Quantitative Performance & Architecture Report', 60, 80);
doc.fillColor('#38bdf8').font('Helvetica-Bold').fontSize(9).text(`DATE: ${new Date().toLocaleDateString('en-US', { dateStyle: 'full' })}  |  DATA SOURCE: SUPABASE LIVE DATABASE`, 60, 105);

doc.y = 145;

// Executive Summary Paragraph
doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(12).text('1. EXECUTIVE PERFORMANCE SUMMARY');
doc.moveDown(0.4);
doc.fillColor(C.text).font('Helvetica').fontSize(9.5).lineGap(2).text(
  `During the evaluated 24-hour testing window, the Focus Trading Engine executed 202 closed positions in simulated dry-run mode on Bitget USDT-Margined perpetual contracts. ` +
  `The bot achieved a win rate of 37.62% and experienced a net realized loss of -1.5015 USDT (a -15.0% drawdown on an initial $10.00 virtual capital base). ` +
  `A critical finding of this audit is that exchange taker fees (-1.2119 USDT) accounted for 80.7% of the entire net loss, driven by hyperactive churning (average hold time of just 66 seconds per trade) and a hyper-tight hard stop loss (0.8% unleveraged move) that prematurely triggered on normal 1-minute altcoin market noise.`
);

doc.moveDown(1);

// Key Performance Indicator (KPI) Cards (2 rows of 4 cards)
const kpis = [
  { label: 'TOTAL TRADES', val: `${summary.totalTrades}`, sub: '24h Execution Count', col: C.accent },
  { label: 'WIN RATE', val: `${summary.winRate}`, sub: `${summary.winningTrades}W / ${summary.losingTrades}L`, col: C.loss },
  { label: 'NET REALIZED PNL', val: `${summary.totalPnL} USDT`, sub: '-15.0% on Capital', col: C.loss },
  { label: 'TOTAL FEES PAID', val: `${summary.totalFees} USDT`, sub: '80.7% of Total Loss', col: C.loss },
  { label: 'GROSS TRADING PNL', val: `${summary.grossPnL} USDT`, sub: 'Before Exchange Fees', col: C.loss },
  { label: 'PROFIT FACTOR', val: `${summary.profitFactor}`, sub: 'Gross Win / Gross Loss', col: C.textDark },
  { label: 'AVG WIN / LOSS', val: `+$${summary.avgWin} / -$${Math.abs(parseFloat(summary.avgLoss)).toFixed(4)}`, sub: 'Reward:Risk = 1.29', col: C.textDark },
  { label: 'AVG HOLD DURATION', val: '1.1 Minutes', sub: 'Min: 0s | Max: 10.8m', col: C.textDark },
];

const startY = doc.y;
const cardW = 122;
const cardH = 50;
const cardGap = 8;

kpis.forEach((kpi, idx) => {
  const row = Math.floor(idx / 4);
  const col = idx % 4;
  const x = 40 + col * (cardW + cardGap);
  const y = startY + row * (cardH + 8);

  doc.rect(x, y, cardW, cardH).fillAndStroke(C.cardBg, C.borderLight);
  doc.fillColor(C.textMuted).font('Helvetica-Bold').fontSize(7).text(kpi.label, x + 8, y + 8);
  doc.fillColor(kpi.col).font('Helvetica-Bold').fontSize(11).text(kpi.val, x + 8, y + 20);
  doc.fillColor(C.textMuted).font('Helvetica').fontSize(6.5).text(kpi.sub, x + 8, y + 36);
});

doc.y = startY + 2 * (cardH + 8) + 15;

// Breakdown Tables (Exit Reasons & Side Performance)
doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(11).text('2. EXECUTION BREAKDOWN: EXITS & DIRECTIONAL BIAS');
doc.moveDown(0.5);

const breakdownY = doc.y;

// Left Box: Exit Reasons
doc.rect(40, breakdownY, 250, 140).fillAndStroke('#ffffff', C.borderLight);
doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(8.5).text('EXIT REASON DISTRIBUTION', 50, breakdownY + 10);

const exitKeys = Object.keys(summary.exitReasons);
let curEy = breakdownY + 28;
doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.textMuted);
doc.text('Reason', 50, curEy);
doc.text('Trades', 160, curEy);
doc.text('Realized PnL', 215, curEy);
curEy += 12;

exitKeys.forEach(k => {
  const item = summary.exitReasons[k];
  doc.font('Helvetica').fontSize(7.5).fillColor(C.textDark);
  doc.text(k, 50, curEy);
  doc.text(`${item.count} (${((item.count / summary.totalTrades) * 100).toFixed(1)}%)`, 160, curEy);
  doc.fillColor(item.pnl >= 0 ? C.win : C.loss).font('Helvetica-Bold');
  doc.text(`${item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(4)}`, 215, curEy);
  curEy += 14;
});

// Observation note under left box
doc.font('Helvetica-Oblique').fontSize(7).fillColor(C.textMuted);
doc.text('* 61.9% of all trades terminated at MAX_LOSS hard stop due to 0.8% noise.', 50, breakdownY + 115, { width: 230 });

// Right Box: Long vs Short Breakdown & Top Coin Impact
doc.rect(305, breakdownY, 250, 140).fillAndStroke('#ffffff', C.borderLight);
doc.fillColor(C.primary).font('Helvetica-Bold').fontSize(8.5).text('DIRECTIONAL & COIN CONCENTRATION', 315, breakdownY + 10);

let curSy = breakdownY + 28;
doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.textMuted);
doc.text('Metric', 315, curSy);
doc.text('Long Positions', 390, curSy);
doc.text('Short Positions', 475, curSy);
curSy += 12;

const longInfo = summary.sideBreakdown.longs;
const shortInfo = summary.sideBreakdown.shorts;

doc.font('Helvetica').fontSize(7.5).fillColor(C.textDark);
doc.text('Count / %', 315, curSy);
doc.text(`${longInfo.count} (${((longInfo.count/202)*100).toFixed(1)}%)`, 390, curSy);
doc.text(`${shortInfo.count} (${((shortInfo.count/202)*100).toFixed(1)}%)`, 475, curSy);
curSy += 14;

doc.text('Win Rate', 315, curSy);
doc.text(`${longInfo.winRate}`, 390, curSy);
doc.text(`${shortInfo.winRate}`, 475, curSy);
curSy += 14;

doc.text('Net PnL', 315, curSy);
doc.fillColor(C.loss).font('Helvetica-Bold');
doc.text(`${longInfo.pnl} USDT`, 390, curSy);
doc.text(`${shortInfo.pnl} USDT`, 475, curSy);
curSy += 16;

doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.textDark);
doc.text('Heavy Loss Concentration:', 315, curSy);
curSy += 10;
doc.font('Helvetica').fontSize(7).fillColor(C.text);
doc.text('• LSKUSDT: 88 trades (43.5% of total) | Net: -0.8047 USDT', 315, curSy);
curSy += 10;
doc.text('• CVCUSDT: 31 trades (15.3% of total) | Net: -0.6030 USDT', 315, curSy);
curSy += 10;
doc.text('=> These 2 coins accounted for 93.7% of all net losses!', 315, curSy);

doc.y = breakdownY + 155;

// Bottom Page 1 notice
doc.rect(40, doc.y, 515, 45).fillAndStroke(C.accentLight, C.accent);
doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(8).text('AUDIT HIGHLIGHT: 100% OF TRADES WERE TIER 2 WITH GROQ LLM APPROVAL', 50, doc.y + 8);
doc.fillColor(C.text).font('Helvetica').fontSize(7.5).text(
  'Every single trade (202 out of 202) was generated by the Tier 2 Momentum detector and approved by the Groq Cloud LLM (openai/gpt-oss-20b). ' +
  'Zero Tier 1 pullback trades triggered. The LLM had a 100% approval rate, meaning the AI acted as a rubber stamp rather than an adversarial risk filter.',
  50, doc.y + 20, { width: 495 }
);

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 2: APPLICATION ARCHITECTURE
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('SYSTEM ARCHITECTURE & EXECUTION PIPELINE', 'Technical Architecture');

doc.font('Helvetica').fontSize(9).fillColor(C.text).text(
  'The Focus Trading Engine v2.0 is a 24/7 cloud-native trading system operating on Bitget USDT perpetual futures. ' +
  'It continuously scans for momentum coins, streams sub-second ticks via WebSocket, evaluates multi-indicator quantitative signals, ' +
  'validates setups via a multi-key Groq Cloud LLM array, and manages positions with dynamic ATR stops.'
);
doc.moveDown(0.8);

// Component Breakdown Cards
const components = [
  {
    name: '1. Coin Selector (coin-selector.ts)',
    tag: 'DYNAMIC VOLATILITY SCANNER',
    desc: 'Scans all Bitget USDT-futures tickers every 30 minutes. Filters out TradFi stocks/commodities/forex. Computes a volatility score = |24h % Move| * log10(Volume USDT). Picks the #1 highest-volatility coin and avoids re-picking the same symbol in consecutive cycles.'
  },
  {
    name: '2. Streaming Data Ingestion (bitget-ws.ts)',
    tag: 'LOW-LATENCY WEBSOCKET',
    desc: 'Maintains persistent WebSocket connection to Bitget public market feeds. Bootstraps 60 x 1m candles and 40 x 5m candles via REST, then live-streams ticks and real-time candle closures. Broadcasts live metrics to Supabase telemetry.'
  },
  {
    name: '3. Quantitative Signal Detector (signal-detector.ts & indicators.ts)',
    tag: 'MULTI-TIMEFRAME CONFLUENCE',
    desc: 'Computes technical indicators on each 1m candle close: EMA 9, EMA 21, EMA 50, RSI 14, ADX 14, Choppiness Index (CHOP), VWAP, MACD (12, 26, 9), ATR 14, and Volume Z-Score. Hierarchical 3-tier signal logic:' +
          '\n  • Tier 1: Pullback in direction of 5m trend (Instant execution, bypasses LLM).' +
          '\n  • Tier 2: Momentum breakout (Requires Groq LLM validation).' +
          '\n  • Tier 3: Choppy/Consolidating (CHOP > 62 or ADX < 20) -> WAIT.'
  },
  {
    name: '4. AI Risk & Narrative Router (llm-router.ts & groq-client.ts)',
    tag: 'GROQ CLOUD MULTI-KEY ARRAY',
    desc: 'Leverages an array of 7 Groq API keys with automatic round-robin rotation and HTTP 429 rate-limit failover. Runs openai/gpt-oss-20b or Llama 3 models. Evaluates the coin narrative and conducts a 4-block risk audit (Audit, Technical, Narrative, Macro) before giving a trade verdict.'
  },
  {
    name: '5. Position Guardian (position-guardian.ts)',
    tag: 'HIGH-PRECISION EXIT MANAGER',
    desc: 'Independent WebSocket tick monitor dedicated to open positions. Evaluates exit criteria on EVERY live price tick:\n' +
          '  • Hard Stop Loss: Triggered when return <= -4.0% (0.8% unleveraged at 5x).\n' +
          '  • Take Profit: Triggered when return >= +6.0% (1.2% unleveraged at 5x).\n' +
          '  • Dynamic Breakeven Stop: Activated once profit exceeds 1.0 ATR.\n' +
          '  • ATR Trailing Stop: Trails peak price by 2.0x ATR.\n' +
          '  • Max Hold Time: 6 hours | Stale Exit: 1.5 hours.'
  },
  {
    name: '6. Telemetry, Database & Server (supabase-logger.ts & server.ts)',
    tag: 'POSTGRESQL + DASHBOARD',
    desc: 'Persists all trades, signals, and telemetry to Supabase tables (futures_trades, market_signals, engine_status, virtual_wallet). Houses a lightweight HTTP server serving /health ping endpoints for Render uptime and hosting a Vite/React dark-mode analytics dashboard.'
  }
];

let compY = doc.y;
components.forEach(comp => {
  checkPageSpace(65);
  compY = doc.y;
  doc.rect(40, compY, 515, 55).fillAndStroke(C.cardBg, C.borderLight);
  doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(7).text(comp.tag, 50, compY + 6);
  doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(9).text(comp.name, 50, compY + 16);
  doc.fillColor(C.text).font('Helvetica').fontSize(7.5).text(comp.desc, 50, compY + 28, { width: 495 });
  doc.y = compY + 62;
});

// Architecture Flow Diagram Box
checkPageSpace(60);
const flowY = doc.y + 5;
doc.rect(40, flowY, 515, 45).fillAndStroke(C.secondary, C.primary);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text('DATA & LOGIC EXECUTION PIPELINE', 50, flowY + 8);
doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5).text(
  'Bitget REST (Scanner) ──> Select Coin ──> Bitget WS (Candles & Ticks) ──> Quantitative Filter (1m + 5m MTF)\n' +
  '       │                                                                            │\n' +
  '       └──> [PASS: Tier 2] ──> Groq LLM Rotation ──> Virtual Order ──> Position Guardian WS (Tick SL/TP/ATR)',
  50, flowY + 20
);
doc.y = flowY + 55;

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 3: QUANTITATIVE FAILURE ANALYSIS & ROOT CAUSES
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('ROOT CAUSE FAILURE ANALYSIS', 'Quantitative Post-Mortem');

doc.font('Helvetica').fontSize(9).fillColor(C.text).text(
  'Why did the bot fail to make a profit during the 24-hour simulation? ' +
  'Analysis of the 202 executed trades, trade durations, and exit logs reveals five fundamental structural and mathematical flaws:'
);
doc.moveDown(0.8);

const flaws = [
  {
    title: 'FLAW 1: FEE DRAG ANNIHILATION (80.7% of Net Losses)',
    severity: 'CRITICAL',
    desc: 'The bot completed 202 round-trip trades in 24 hours (~8.4 trades/hour). On Bitget, taker fees are 0.06% on entry and 0.06% on exit (0.12% total). With 5x leverage, every trade paid $0.006 in fees on a $1.00 margin. Over 202 trades, total fees reached 1.2119 USDT against a gross trading loss of only -0.2896 USDT. The bot was churning trades so rapidly that fee friction consumed 12% of the total account balance.'
  },
  {
    title: 'FLAW 2: STOP LOSS PLACED INSIDE NOISE BAND (0.8% Adverse Move)',
    severity: 'CRITICAL',
    desc: 'The configuration defined MAX_LOSS_PCT = 0.04 (4% leveraged). With LEVERAGE = 5, the unleveraged price stop was just 0.8% (0.04 / 5 = 0.008). On high-beta altcoins (LSK, CVC, STEEM), the natural 1-minute candle wick size and bid-ask spread is routinely 0.8% to 1.5%. Consequently, 125 out of 202 trades (61.9%) were stopped out almost instantly by market noise, leading to an average trade lifespan of just 66 seconds.'
  },
  {
    title: 'FLAW 3: GROQ LLM "RUBBER STAMPING" & LACK OF ADVERSARIAL SKEPTICISM',
    severity: 'HIGH',
    desc: 'All 202 trades were classified as Tier 2 and routed to Groq Cloud LLM. The LLM approved 100% of the candidate signals submitted to it. The prompt instructed the LLM to verify narrative and technical risk, but the model acted as an uncritical confirmation echo-chamber. An AI risk filter must have a selective approval rate (e.g. 20–30% approval) to filter out marginal setups.'
  },
  {
    title: 'FLAW 4: COIN OVER-CONCENTRATION & RE-ENTRY CHURNING',
    severity: 'HIGH',
    desc: 'The engine took 88 trades on LSKUSDT (-0.8047 USDT) and 31 trades on CVCUSDT (-0.6030 USDT). Together, these two coins generated 93.7% of all losses. When a trade was stopped out, the 2-minute cooldown would lapse, and because the coin was still volatile, the engine immediately re-entered the exact same choppy asset. There was no consecutive-loss circuit breaker.'
  },
  {
    title: 'FLAW 5: TIMEFRAME MISMATCH & TRAILING STOP BYPASS',
    severity: 'MEDIUM',
    desc: 'The bot traded 1-minute momentum breakouts. 1-minute crypto breakouts have a notoriously high false-breakout rate. Furthermore, only 1 trade out of 202 ever exited via ATR_TRAILING_STOP. Because the hard stop was so tight, positions were terminated before they could ever develop sufficient profit to engage the trailing stop or breakeven mechanisms.'
  }
];

let flawY = doc.y;
flaws.forEach(flaw => {
  checkPageSpace(75);
  flawY = doc.y;
  doc.rect(40, flawY, 515, 65).fillAndStroke(C.cardBg, C.borderLight);
  doc.fillColor(C.loss).font('Helvetica-Bold').fontSize(7.5).text(`[${flaw.severity}]`, 50, flawY + 8);
  doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(9).text(flaw.title, 110, flawY + 8);
  doc.fillColor(C.text).font('Helvetica').fontSize(7.5).text(flaw.desc, 50, flawY + 22, { width: 495 });
  doc.y = flawY + 72;
});

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 4: STRATEGIC RECOMMENDATIONS & PROMPT FOR OTHER AIs
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader('ACTIONABLE FIXES & AI ADVISORY PROMPT', 'Optimization Roadmap');

doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(11).text('1. TOP 5 ENGINEERING FIXES TO ACHIEVE PROFITABILITY');
doc.moveDown(0.4);

const fixes = [
  '1. Widen Stop Loss to Structural ATR Levels (Min 1.5x - 2.5x ATR): Stop using a static 0.8% price move. Place stops below recent 5m swing lows/highs or 2x ATR (typically 1.5% - 3.0% unleveraged), reducing leverage to 2x or 3x so dollar risk per trade stays constant while giving trades breathing room.',
  '2. Implement a Consecutive Loss Circuit Breaker: If an asset suffers 2 consecutive stop-outs in a row, block that coin from being selected or traded for at least 4 hours. This prevents the 88-trade churn on LSKUSDT.',
  '3. Migrate Primary Decision Engine from 1m to 5m/15m Candles: 1-minute charts are dominated by HFT market-maker noise. Executing on 5m or 15m closed candles with a confirmed higher-timeframe trend will cut trade frequency by 80% and eliminate fee churn.',
  '4. Overhaul Groq LLM Prompt with Strict Skepticism: Instruct the LLM that its primary job is capital protection. Force it to reject at least 70% of candidate setups by requiring strict criteria: no entry if RSI is extended (>65 for longs), no entry if volume is below 1.5 Z-score, and require explicit structural support.',
  '5. Utilize Maker Post-Only Limit Orders: Shift from aggressive taker market orders to limit orders placed at key pullback levels (e.g. EMA 21 or VWAP retest). Maker orders earn fee discounts or rebates, completely eliminating the $1.21 fee drag.'
];

fixes.forEach(fix => {
  doc.fillColor(C.text).font('Helvetica').fontSize(8).lineGap(1.5).text(fix, { indent: 10 });
  doc.moveDown(0.3);
});

doc.moveDown(0.8);

// Ready-to-use Prompt for Other AI Models
doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(11).text('2. READY-TO-USE PROMPT FOR OTHER AI CONSULTANTS (Claude / DeepSeek / GPT-4o)');
doc.moveDown(0.4);

const promptText = 
`"I am sharing a 24-hour simulation performance audit and architecture of our algorithmic trading bot (Focus Trading Engine v2.0). 
The bot runs on Bitget USDT Perpetual Futures with 5x leverage and a $1.00 margin per trade. In 24 hours, it took 202 trades, won 37.62% (76W / 126L), and lost -1.5015 USDT. 
Key Findings:
1. Fees accounted for 80.7% of total loss (-1.2119 USDT) due to hyper-churning (avg duration 66s).
2. 61.9% of trades exited at MAX_LOSS (-4.0% leveraged = 0.8% unleveraged move), getting stopped out by 1-minute candle noise.
3. 100% of trades were Tier 2 momentum breakouts approved by Groq LLM (100% approval rate, acting as an uncritical rubber stamp).
4. Heavy concentration: 88 trades on LSKUSDT and 31 on CVCUSDT accounted for 93.7% of all losses.
5. Primary timeframe is 1m with 5m confirmation.

Based on this data and the system architecture provided in this PDF:
1. What mathematical adjustments to Stop Loss, Take Profit, and ATR multipliers should we implement to ensure positive expectancy?
2. How should we restructure the Groq LLM prompt and scoring weights so it acts as an adversarial risk filter instead of approving everything?
3. What rule-based filters (e.g. volume thresholds, time-of-day, cooldowns, volatility regime) would effectively eliminate the churn on choppy coins like LSK and CVC?
4. Should we transition the primary timeframe to 5m or 15m, and how should entry execution be redesigned (e.g. limit orders at VWAP/EMA retests vs market breakouts)?"`;

const promptBoxY = doc.y;
doc.rect(40, promptBoxY, 515, 205).fillAndStroke(C.cardBg, C.accent);
doc.fillColor(C.accent).font('Helvetica-Bold').fontSize(8).text('COPY & PASTE THIS PROMPT TO OTHER AI MODELS:', 50, promptBoxY + 8);
doc.fillColor(C.textDark).font('Courier').fontSize(7.5).text(promptText, 50, promptBoxY + 22, { width: 495, lineGap: 1.5 });

doc.y = promptBoxY + 215;

// ═════════════════════════════════════════════════════════════════════════════
// PAGES 5+: COMPLETE 24-HOUR TRADE LOG TABLE
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
drawHeader(`COMPLETE 24-HOUR TRADE LOG (${trades.length} TRADES)`, 'Database Audit Log');

doc.font('Helvetica').fontSize(8).fillColor(C.text).text(
  'The following table lists all 202 simulated trades recorded in the Supabase futures_trades table over the last 24 hours in chronological order. ' +
  'Green represents winning positions; Red represents losing positions.'
);
doc.moveDown(0.6);

// Table configuration
const colX = {
  num: 40,
  time: 60,
  sym: 120,
  side: 185,
  entry: 220,
  exit: 265,
  returnPct: 315,
  pnl: 365,
  fee: 420,
  dur: 455,
  reason: 490
};

function drawTableHeader() {
  const y = doc.y;
  doc.rect(40, y, 515, 14).fill(C.secondary);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(6.5);
  doc.text('#', colX.num + 2, y + 3.5);
  doc.text('Time (UTC)', colX.time, y + 3.5);
  doc.text('Symbol', colX.sym, y + 3.5);
  doc.text('Side', colX.side, y + 3.5);
  doc.text('Entry ($)', colX.entry, y + 3.5);
  doc.text('Exit ($)', colX.exit, y + 3.5);
  doc.text('Return %', colX.returnPct, y + 3.5);
  doc.text('PnL ($)', colX.pnl, y + 3.5);
  doc.text('Fee ($)', colX.fee, y + 3.5);
  doc.text('Dur.', colX.dur, y + 3.5);
  doc.text('Exit Reason', colX.reason, y + 3.5);
  doc.y = y + 16;
}

drawTableHeader();

trades.forEach((t, i) => {
  if (doc.y > 770) {
    doc.addPage();
    drawHeader(`COMPLETE 24-HOUR TRADE LOG (CONT.)`, 'Database Audit Log');
    drawTableHeader();
  }

  const y = doc.y;
  const isWin = (t.realized_pnl || 0) > 0;
  const rowBg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
  
  doc.rect(40, y, 515, 12).fill(rowBg);

  const timeStr = t.created_at ? t.created_at.substring(11, 19) : '--';
  const entryStr = t.entry_price < 0.01 ? t.entry_price.toFixed(6) : t.entry_price < 1 ? t.entry_price.toFixed(4) : t.entry_price.toFixed(2);
  const exitStr = t.exit_price < 0.01 ? t.exit_price.toFixed(6) : t.exit_price < 1 ? t.exit_price.toFixed(4) : t.exit_price.toFixed(2);
  const returnStr = `${(t.return_pct || 0) >= 0 ? '+' : ''}${(t.return_pct || 0).toFixed(1)}%`;
  const pnlStr = `${(t.realized_pnl || 0) >= 0 ? '+' : ''}${(t.realized_pnl || 0).toFixed(4)}`;
  const feeStr = `${(t.fee || 0).toFixed(4)}`;

  let durStr = '--';
  if (t.closed_at && t.created_at) {
    const sec = Math.round((new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 1000);
    durStr = sec < 60 ? `${sec}s` : `${(sec / 60).toFixed(1)}m`;
  }

  let cleanReason = (t.exit_reason || '').split(':')[0].trim();
  if (cleanReason === 'MAX_LOSS') cleanReason = 'MAX_LOSS';
  else if (cleanReason === 'TAKE_PROFIT') cleanReason = 'TAKE_PROFIT';
  else if (cleanReason.includes('TRAILING')) cleanReason = 'TRAIL_STOP';
  else cleanReason = cleanReason.substring(0, 10);

  doc.fillColor(C.textMuted).font('Helvetica').fontSize(6).text(`${i + 1}`, colX.num + 2, y + 2.5);
  doc.fillColor(C.text).font('Helvetica').fontSize(6).text(timeStr, colX.time, y + 2.5);
  doc.fillColor(C.textDark).font('Helvetica-Bold').fontSize(6).text(t.symbol, colX.sym, y + 2.5);
  doc.fillColor(t.position_side === 'LONG' ? C.win : C.loss).font('Helvetica-Bold').fontSize(6).text(t.position_side, colX.side, y + 2.5);
  doc.fillColor(C.text).font('Helvetica').fontSize(6).text(entryStr, colX.entry, y + 2.5);
  doc.fillColor(C.text).font('Helvetica').fontSize(6).text(exitStr, colX.exit, y + 2.5);
  doc.fillColor(isWin ? C.win : C.loss).font('Helvetica-Bold').fontSize(6).text(returnStr, colX.returnPct, y + 2.5);
  doc.fillColor(isWin ? C.win : C.loss).font('Helvetica-Bold').fontSize(6).text(pnlStr, colX.pnl, y + 2.5);
  doc.fillColor(C.textMuted).font('Helvetica').fontSize(6).text(feeStr, colX.fee, y + 2.5);
  doc.fillColor(C.text).font('Helvetica').fontSize(6).text(durStr, colX.dur, y + 2.5);
  doc.fillColor(isWin ? C.win : C.loss).font('Helvetica-Bold').fontSize(5.5).text(cleanReason, colX.reason, y + 2.5);

  doc.y = y + 12;
});

// Final Page Numbering & Footer across all buffered pages
const totalPages = doc.bufferedPageRange().count;
for (let i = 0; i < totalPages; i++) {
  doc.switchToPage(i);
  doc.fillColor(C.textMuted).font('Helvetica').fontSize(7);
  doc.text(
    `Focus Trading Engine v2.0  •  Confidential Performance Audit  •  Page ${i + 1} of ${totalPages}`,
    40,
    810,
    { align: 'center', width: 515 }
  );
}

doc.end();

writeStream.on('finish', () => {
  console.log(`✅ PDF successfully generated at: ${outputPath}`);
  console.log(`Total Pages: ${totalPages}`);
});
