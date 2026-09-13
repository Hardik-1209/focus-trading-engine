import { useState } from 'react';
import { useGlobalStore } from './store/useGlobalStore';
import type { DashboardPage } from './store/useGlobalStore';
import { useSupabaseStream } from './hooks/useSupabaseStream';
import { useBitgetLivePrice } from './hooks/useBitgetLivePrice';
import { TradeDetailModal } from './components/TradeDetailModal';
import { ResetSessionModal } from './components/ResetSessionModal';
import { ApiKeyHealthModal, ApiKeyHealthPanel } from './components/ApiKeyHealthModal';
import {
  formatUSD,
  formatINR,
  formatIndianDateTime,
  formatIndianTime,
} from './utils/formatters';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  LayoutDashboard,
  Eye,
  Coins,
  Bot,
  BookOpen,
  Activity,
  TrendingUp,
  ShieldCheck,
  Zap,
  Cpu,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Archive,
  AlertTriangle,
  Scale,
  Gauge,
  Sliders,
  ChevronRight,
} from 'lucide-react';

export function OverviewDashboard() {
  useSupabaseStream();
  useBitgetLivePrice();

  const {
    trades,
    focusLogs,
    engineStatus,
    activePage,
    setActivePage,
    walletBalance,
    inrRate,
    livePrices,
    sessions,
    selectedSessionId,
    setSelectedSessionId,
    selectedTrade,
    setSelectedTrade,
  } = useGlobalStore();

  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showKeyHealthModal, setShowKeyHealthModal] = useState(false);


  // Session Filtering: 'active' shows unarchived live trades, specific session ID shows that snapshot, 'all' shows all
  const sessionTrades = trades.filter((t) => {
    if (selectedSessionId === 'all') return true;
    if (selectedSessionId === 'active') return !t.is_archived;
    return t.session_id === selectedSessionId;
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);
  const displayBalance = (selectedSessionId !== 'active' && selectedSession?.final_balance !== undefined)
    ? selectedSession.final_balance
    : walletBalance;

  // Active open trade (if any)
  const openTrades = sessionTrades.filter((t) => t.status === 'OPEN');
  const closedTrades = sessionTrades.filter((t) => t.status === 'CLOSED');

  const sessionRealizedPnl = closedTrades.reduce((acc, t) => acc + parseFloat((t.realized_pnl as any) || '0'), 0);
  const displayPnl = (selectedSessionId !== 'active' && selectedSession?.total_pnl !== undefined)
    ? selectedSession.total_pnl
    : sessionRealizedPnl;

  // Filtered closed trades
  const filteredClosedTrades = closedTrades.filter((t) => {
    if (selectedFilter === 'ALL') return true;
    return t.position_side === selectedFilter;
  });

  // Calculate Cumulative PnL Curve data
  let runningPnl = 0;
  const equityCurveData = closedTrades.length > 0 ? [
    { time: 'Start', pnl: 0, inrPnl: 0 },
    ...closedTrades.slice().reverse().map((t, idx) => {
      const p = parseFloat((t.realized_pnl as any) || '0');
      runningPnl += p;
      return {
        time: t.closed_at ? formatIndianTime(t.closed_at) : `#${idx + 1}`,
        pnl: parseFloat(runningPnl.toFixed(4)),
        inrPnl: parseFloat((runningPnl * inrRate).toFixed(2)),
      };
    }),
  ] : [
    { time: '00:00', pnl: 0, inrPnl: 0 },
    { time: 'Now', pnl: 0, inrPnl: 0 }
  ];

  // Live Indicators from Engine Status (or default v3.0 fallback)
  const liveInd = engineStatus?.live_indicators || {
    rsi: 50.0,
    adx: 22.5,
    chop: 44.0,
    vwap: 0,
    mtf: '15m REGIME SCANNING',
    regime: 'ANALYZING',
    atr: 0,
    volZ: 0.0,
    price: 0,
    risk_governor: {
      dailyHalted: false,
      dailyStartingBalance: 10.00,
      dailyRealizedPnl: 0,
      dailyDrawdownPct: 0,
      activeCooldowns: [],
      rollingExpectancy: 0,
      rollingWinRate: 0,
      llmTotalEvaluations: 0,
      llmApprovals: 0,
      llmApprovalRate: 0,
      version: '3.0.0',
    }
  };

  const riskGov = liveInd.risk_governor || {
    dailyHalted: false,
    dailyStartingBalance: 10.00,
    dailyRealizedPnl: 0,
    dailyDrawdownPct: 0,
    activeCooldowns: [],
    rollingExpectancy: 0,
    rollingWinRate: 0,
    llmTotalEvaluations: 0,
    llmApprovals: 0,
    llmApprovalRate: 0,
    version: '3.0.0',
  };

  const focusedCoin = engineStatus?.focused_symbol || 'Scanning (v3.0)...';
  const cycleCount = engineStatus?.cycle_count || 1;

  // Realized stats
  const totalClosed = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => parseFloat((t.realized_pnl as any) || '0') > 0);
  const losingTrades = closedTrades.filter((t) => parseFloat((t.realized_pnl as any) || '0') < 0);
  const winRate = totalClosed > 0 ? ((winningTrades.length / totalClosed) * 100).toFixed(1) : '0.0';

  const totalGrossWin = winningTrades.reduce((acc, t) => acc + parseFloat((t.realized_pnl as any) || '0'), 0);
  const totalGrossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + parseFloat((t.realized_pnl as any) || '0'), 0));
  const profitFactor = totalGrossLoss > 0 ? (totalGrossWin / totalGrossLoss).toFixed(2) : totalGrossWin > 0 ? '∞' : '0.00';

  const avgWin = winningTrades.length > 0 ? totalGrossWin / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalGrossLoss / losingTrades.length : 0;

  // Active cooldowns check
  const activeCooldowns = riskGov.activeCooldowns || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-28 md:pb-12 antialiased selection:bg-cyan-500/20">
      {/* ─── STICKY HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-850 px-3 py-2.5 sm:px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Main Header Row */}
          <div className="flex items-center justify-between gap-2">
            {/* Logo & Subtitle */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/40 shrink-0 animate-gemini-pulse">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-black tracking-wider text-sm sm:text-base md:text-lg bg-gradient-to-r from-white via-cyan-100 to-slate-300 bg-clip-text text-transparent truncate">
                    FOCUS ENGINE
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider px-1.5 sm:px-2 py-0.5 rounded-md bg-gradient-to-r from-cyan-950 via-indigo-950 to-purple-950 text-cyan-300 border border-cyan-500/40 shrink-0 shadow-sm">
                    v3.1 QUANT
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium hidden sm:block truncate">
                  15m Structural Regime · Gemini 3.6 Flash Dual-Engine CRO · 3x Isolated
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Gemini 3.6 Flash Cluster Pill & Modal Trigger */}
              <button
                onClick={() => setShowKeyHealthModal(true)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-gradient-to-r from-cyan-950/80 via-indigo-950/80 to-purple-950/80 border border-cyan-500/40 hover:border-cyan-300 text-cyan-300 text-[10px] sm:text-[11px] font-bold transition-all shadow-sm shadow-cyan-950/60 cursor-pointer active:scale-95"
                title="View Gemini & Groq Cluster Health and Key Rotation"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse shrink-0" />
                <span className="hidden sm:inline">Gemini 3.6</span>
                <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-mono border border-cyan-500/30">
                  Key #{((liveInd as any)?.gemini_cluster?.activeKeyIndex ?? 1)}
                </span>
              </button>

              {/* Live Status Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold shadow-sm shadow-emerald-950/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="tracking-wide hidden sm:inline">24/7 LIVE</span>
                <span className="tracking-wide sm:hidden text-[10px]">LIVE</span>
              </div>

              {/* Reset Session Button */}
              <button
                onClick={() => setShowResetModal(true)}
                title="Archive current session trades and reset to $10.00 capital & Cycle #1"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold transition-all shadow-sm cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Reset</span>
              </button>

              {/* Live INR Conversion Badge (Desktop) */}
              <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[11px] font-semibold text-slate-300">
                <span className="text-amber-400 font-bold">1 USDT</span>
                <span className="text-slate-500">≈</span>
                <span className="text-emerald-400 font-bold">₹{inrRate.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Session Selector Strip (Optimized for Mobile & Desktop) */}
          <div className="mt-2 pt-2 border-t border-slate-900/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-slate-900/80 border border-slate-800 rounded-xl px-2 py-1 text-xs">
              <Archive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer w-full truncate"
              >
                <option value="active" className="bg-slate-900 text-emerald-400 font-bold">
                  🟢 Active Live Session (v3.0 Clean Slate)
                </option>
                {sessions.map((s, idx) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                    📦 {s.name || `Snapshot #${idx + 1}`} ({s.total_trades}T · {s.total_pnl >= 0 ? '+' : ''}${s.total_pnl})
                  </option>
                ))}
                <option value="all" className="bg-slate-900 text-indigo-300 font-bold">📚 All-Time Combined</option>
              </select>
            </div>

            {/* Mobile INR Conversion Mini-Pill */}
            <div className="lg:hidden flex items-center gap-1 px-2 py-1 bg-slate-900/80 border border-slate-800 rounded-xl text-[10px] font-semibold text-slate-300 shrink-0">
              <span className="text-amber-400 font-bold">₹{inrRate.toFixed(1)}</span>
              <span className="text-slate-500">/USDT</span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1 mt-2 pt-2 border-t border-slate-900">
            {[
              { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
              { id: 'scanner', label: 'Live Scanner & Regime', icon: Eye },
              { id: 'trades', label: 'Active Positions', icon: Coins, count: openTrades.length },
              { id: 'brain', label: 'Adversarial CRO AI', icon: Bot },
              { id: 'apikeys', label: 'AI Key Cluster', icon: Cpu },
              { id: 'ledger', label: 'Trade Ledger', icon: BookOpen, count: closedTrades.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePage(tab.id as DashboardPage)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT CONTAINER ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 mt-3 sm:mt-5 space-y-3.5 sm:space-y-5">
        {/* ─── HISTORICAL SNAPSHOT BANNER (IF VIEWING ARCHIVED SESSION) ───────────── */}
        {selectedSessionId !== 'active' && (
          <div className="bg-gradient-to-r from-amber-950/70 via-slate-900/90 to-amber-950/70 border border-amber-500/40 text-amber-200 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-black block truncate">
                  Historical Snapshot: {selectedSession?.name || (selectedSessionId === 'all' ? 'All-Time Combined Ledger' : 'Archived Snapshot')}
                </span>
                <span className="text-[10px] sm:text-[11px] text-amber-300/80 block truncate">
                  {selectedSession ? `Archived with ${selectedSession.total_trades} trades · Net P&L: ${selectedSession.total_pnl >= 0 ? '+' : ''}$${selectedSession.total_pnl}` : 'Historical trades and active trades combined.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedSessionId('active')}
              className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer active:scale-95 shrink-0"
            >
              Return to Live ➔
            </button>
          </div>
        )}

        {/* ─── V3.0 INSTITUTIONAL RISK GOVERNANCE & HEALTH STRIP ─────────────────── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            {/* Left: Circuit Breaker & Kill Switch Status */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-semibold text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400 text-[11px]">Circuit Breakers:</span>
                {activeCooldowns.length === 0 ? (
                  <span className="text-emerald-400 font-bold text-[11px]">🛡️ All Pairs Active</span>
                ) : (
                  <span className="text-amber-400 font-bold text-[11px]">
                    ⚠️ {activeCooldowns.length} Symbol{activeCooldowns.length > 1 ? 's' : ''} Frozen
                  </span>
                )}
              </div>

              {/* Daily Drawdown Gauge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-semibold text-slate-300">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400 text-[11px]">Daily DD:</span>
                <span className={`font-bold text-[11px] ${riskGov.dailyDrawdownPct > 3 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {(riskGov.dailyDrawdownPct || 0).toFixed(2)}%
                </span>
                <span className="text-slate-500 text-[10px]">/ 5.0% Kill Limit</span>
              </div>

              {/* Adversarial CRO Approval Rate */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 font-semibold text-slate-300">
                <Scale className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-400 text-[11px]">CRO Approval:</span>
                <span className="text-purple-300 font-bold text-[11px]">
                  {(riskGov.llmApprovalRate || 0).toFixed(1)}%
                </span>
                <span className="text-slate-500 text-[10px] hidden sm:inline">(Target: 20-35%)</span>
              </div>
            </div>

            {/* Right: Rolling Expectancy EV & Sizing */}
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-950/40 border border-cyan-800/40 font-bold text-cyan-300">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>3x Leverage · 1.8x / 3.2x ATR Stop</span>
              </div>
            </div>
          </div>

          {/* If there are frozen coins in cooldown, display warning bar */}
          {activeCooldowns.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-850 flex flex-wrap items-center gap-1.5 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-amber-300 font-bold">Cooldown Active:</span>
              {activeCooldowns.map((cd) => (
                <span key={cd.symbol} className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200 font-mono font-semibold">
                  {cd.symbol} ({cd.cooldownRemainingMin}m left · {cd.consecutiveLosses} losses)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ─── TELEMETRY TICKER BAR & SWIPEABLE CHIP STRIP (MOBILE OPTIMIZED) ──────── */}
        <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-3 sm:p-3.5 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Eye className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <span>Current Target</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5 truncate">
                  <span className="truncate">{focusedCoin}</span>
                  <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40 font-mono font-bold shrink-0">
                    Cycle #{cycleCount}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">15m Regime</div>
              <div className="text-xs font-black text-emerald-400 uppercase">
                {liveInd.regime || 'EXPANSION'}
              </div>
            </div>
          </div>

          {/* Swipeable Indicator Chips Strip (Native Touch Scroll on Phone) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs select-none">
            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1 shrink-0 text-[11px]">
              <span className="text-slate-500">RSI:</span>
              <span className={liveInd.rsi > 65 ? 'text-rose-400' : liveInd.rsi < 35 ? 'text-emerald-400' : 'text-cyan-400'}>
                {liveInd.rsi?.toFixed(1) || '50.0'}
              </span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1 shrink-0 text-[11px]">
              <span className="text-slate-500">ADX:</span>
              <span className={liveInd.adx > 25 ? 'text-emerald-400' : 'text-amber-400'}>
                {liveInd.adx?.toFixed(1) || '22.0'}
              </span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1 shrink-0 text-[11px]">
              <span className="text-slate-500">CHOP:</span>
              <span className={liveInd.chop > 61.8 ? 'text-rose-400' : 'text-emerald-400'}>
                {liveInd.chop?.toFixed(1) || '44.0'}
              </span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1 shrink-0 text-[11px]">
              <span className="text-slate-500">15m MTF:</span>
              <span className={liveInd.mtf?.includes('BULL') ? 'text-emerald-400' : liveInd.mtf?.includes('BEAR') ? 'text-rose-400' : 'text-slate-400'}>
                {liveInd.mtf || 'NEUTRAL'}
              </span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1 shrink-0 text-[11px]">
              <span className="text-slate-500">ATR:</span>
              <span className="text-white">{formatUSD(liveInd.atr || 0)}</span>
            </div>

            <div className="px-2 py-1 rounded-lg bg-indigo-950/50 border border-indigo-500/30 font-bold text-indigo-300 shrink-0 text-[11px]">
              CRO Gatekeeper Active
            </div>
          </div>
        </div>

        {/* ─── 4 TOP STAT CARDS (DUAL CURRENCY: USD + INR) ───────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Card 1: Balance */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-semibold mb-1 sm:mb-2">
              <span>WALLET BALANCE</span>
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
              {formatUSD(displayBalance)}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className="text-[10px] sm:text-xs font-extrabold text-emerald-400 bg-emerald-950/60 px-1.5 sm:px-2 py-0.5 rounded border border-emerald-800/40 truncate">
                {formatINR(displayBalance, inrRate)}
              </span>
            </div>
          </div>

          {/* Card 2: Net Realized PnL */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-semibold mb-1 sm:mb-2">
              <span>NET REALIZED PNL</span>
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div className={`text-lg sm:text-2xl font-black tracking-tight truncate ${displayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {displayPnl >= 0 ? '+' : ''}{formatUSD(displayPnl)}
            </div>
            <div className="mt-1 flex items-center gap-1">
              <span className={`text-[10px] sm:text-xs font-extrabold px-1.5 sm:px-2 py-0.5 rounded border truncate ${displayPnl >= 0 ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' : 'text-rose-400 bg-rose-950/60 border-rose-800/40'}`}>
                {displayPnl >= 0 ? '+' : ''}{formatINR(displayPnl, inrRate)}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-500 font-medium hidden sm:inline">{totalClosed} closed</span>
            </div>
          </div>

          {/* Card 3: Win Rate */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-semibold mb-1 sm:mb-2">
              <span>WIN RATE</span>
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {winRate}%
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
              <span className="text-emerald-400 font-bold">{winningTrades.length}W</span> · <span className="text-rose-400 font-bold">{losingTrades.length}L</span> · PF: <span className="text-white font-bold">{profitFactor}</span>
            </div>
          </div>

          {/* Card 4: Active Positions */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-3 sm:p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-[11px] sm:text-xs font-semibold mb-1 sm:mb-2">
              <span>ACTIVE POSITION</span>
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
            <div className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {openTrades.length} Open
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-slate-400 font-medium flex items-center gap-1 truncate">
              <span className="text-cyan-400 font-bold">3x Leverage</span>
              <span>· Triple Barrier</span>
            </div>
          </div>
        </div>

        {/* ─── ACTIVE OPEN POSITION CARD (IF TRADE OPEN) ───────────────────────── */}
        {openTrades.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Live Active Futures Position</span>
            </h2>
            {openTrades.map((pos) => {
              const livePrice = livePrices[pos.symbol] || parseFloat(pos.entry_price as any);
              const entry = parseFloat(pos.entry_price as any);
              const amount = pos.amount;
              const pnl = pos.position_side === 'LONG' ? (livePrice - entry) * amount : (entry - livePrice) * amount;
              const roi = entry > 0 ? ((pnl / (entry * amount / 3)) * 100).toFixed(2) : '0.00';
              const isProfit = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black tracking-wider uppercase ${pos.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-md shadow-rose-500/20'}`}>
                        {pos.position_side} 3X
                      </span>
                      <div>
                        <div className="text-base sm:text-xl font-black text-white">{pos.symbol}</div>
                        <div className="text-[10px] sm:text-[11px] text-slate-400">Opened: {formatIndianDateTime(pos.created_at)}</div>
                      </div>
                    </div>

                    {/* Live Unrealized PnL */}
                    <div className="text-right">
                      <div className="text-[10px] sm:text-xs text-slate-400 font-semibold">Unrealized P&L</div>
                      <div className={`text-lg sm:text-2xl font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{formatUSD(pnl)}
                        <span className="text-xs sm:text-sm ml-1 font-bold">({roi}%)</span>
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-slate-300">
                        {isProfit ? '+' : ''}{formatINR(pnl, inrRate)}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-850">
                      <div className="text-slate-500 text-[10px] font-semibold mb-0.5">Entry Price</div>
                      <div className="text-white font-bold">{formatUSD(entry)}</div>
                      <div className="text-[10px] text-slate-400">{formatINR(entry, inrRate)}</div>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-850">
                      <div className="text-slate-500 text-[10px] font-semibold mb-0.5">Mark Price</div>
                      <div className="text-cyan-400 font-bold">{formatUSD(livePrice)}</div>
                      <div className="text-[10px] text-slate-400">{formatINR(livePrice, inrRate)}</div>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-850">
                      <div className="text-slate-500 text-[10px] font-semibold mb-0.5">Triple Barrier Levels</div>
                      <div className="text-emerald-400 font-bold text-[11px]">
                        TP: {pos.take_profit_price ? formatUSD(pos.take_profit_price) : '+3.2x ATR'}
                      </div>
                      <div className="text-rose-400 text-[10px] font-bold">
                        SL: {pos.stop_loss_price ? formatUSD(pos.stop_loss_price) : '-1.8x ATR'}
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-850">
                      <div className="text-slate-500 text-[10px] font-semibold mb-0.5">Position Sizing</div>
                      <div className="text-white font-bold">{amount.toFixed(2)} {pos.symbol.replace('USDT', '')}</div>
                      <div className="text-[10px] text-slate-400">{formatUSD(amount * entry)} Notional</div>
                    </div>
                  </div>

                  {/* Audit Button */}
                  <button
                    onClick={() => setSelectedTrade(pos)}
                    className="mt-3 w-full py-2 px-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Live Groq CRO Reasoning & Confluence</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* When no active position, show Live Scanner & Radar Card */
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                  <h3 className="font-black text-sm sm:text-base md:text-lg text-white">Live Market Scanner & Regime Radar</h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  Targeting liquid Bitget futures (&gt;$5M vol) with 15m structural trend + 5m pullback rejection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 text-xs font-bold truncate">
                  Target: {focusedCoin}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                  {formatUSD(liveInd.price || 0)}
                </span>
              </div>
            </div>

            {/* Indicator Radar Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">15M REGIME</div>
                <div className="text-sm sm:text-base font-black mt-1 text-emerald-400 truncate">
                  {liveInd.regime || 'EXPANSION'}
                </div>
                <div className="text-[10px] text-slate-500">Macro Structure</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">RSI (14)</div>
                <div className={`text-sm sm:text-base font-black mt-1 ${liveInd.rsi > 65 ? 'text-rose-400' : liveInd.rsi < 35 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {liveInd.rsi?.toFixed(1) || '50.0'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.rsi > 65 ? 'Overbought' : liveInd.rsi < 35 ? 'Oversold' : 'Neutral Zone'}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">ADX TREND</div>
                <div className={`text-sm sm:text-base font-black mt-1 ${liveInd.adx > 25 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {liveInd.adx?.toFixed(1) || '22.0'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.adx > 25 ? 'Strong Trend' : 'Ranging Flow'}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">CHOP INDEX</div>
                <div className={`text-sm sm:text-base font-black mt-1 ${liveInd.chop > 61.8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {liveInd.chop?.toFixed(1) || '44.0'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.chop > 61.8 ? 'Choppy Range' : 'Directional Clean'}</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">LIQUIDITY FLOOR</div>
                <div className="text-sm sm:text-base font-black text-white mt-1">
                  &gt; $5M
                </div>
                <div className="text-[10px] text-emerald-400 font-bold">Max Spread 0.15%</div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">ATR VOLATILITY</div>
                <div className="text-sm sm:text-base font-black text-white mt-1">
                  {formatUSD(liveInd.atr || 0)}
                </div>
                <div className="text-[10px] text-slate-400">{formatINR(liveInd.atr || 0, inrRate)}</div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: OVERVIEW (Charts & Performance) ──────────────────────────────── */}
        {(activePage === 'overview' || activePage === 'scanner') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {/* Equity Curve Chart */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <h3 className="font-black text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span>Cumulative P&L Curve</span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400">Compounding performance in USD & INR</p>
                </div>
                <div className="text-right">
                  <div className={`font-black text-sm sm:text-base md:text-lg ${displayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {displayPnl >= 0 ? '+' : ''}{formatUSD(displayPnl)}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold text-slate-400">
                    {displayPnl >= 0 ? '+' : ''}{formatINR(displayPnl, inrRate)}
                  </div>
                </div>
              </div>

              <div className="h-48 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurveData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#1e293b',
                        borderRadius: '12px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                      formatter={(value: any) => [
                        `${formatUSD(value)} (${formatINR(value, inrRate)})`,
                        'Realized P&L',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pnl"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: '#38bdf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quantitative Risk Breakdown */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-black text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>v3.0 Quant Risk Guard</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 mb-3 sm:mb-4">Risk parameters & execution guardrails</p>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[11px]">Consecutive Loss Freeze</span>
                    <span className="font-black text-amber-300 text-xs">4h Cooldown (2 losses)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[11px]">Average Win</span>
                    <div className="text-right">
                      <span className="font-black text-emerald-400 text-xs">+{formatUSD(avgWin)}</span>
                      <div className="text-[9px] text-slate-400">+{formatINR(avgWin, inrRate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[11px]">Average Loss</span>
                    <div className="text-right">
                      <span className="font-black text-rose-400 text-xs">-{formatUSD(avgLoss)}</span>
                      <div className="text-[9px] text-slate-400">-{formatINR(avgLoss, inrRate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400 text-[11px]">Fee-Aware Breakeven</span>
                    <span className="font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40 text-[10px]">
                      +1.2x ATR Level
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-850 text-[10px] text-slate-500 text-center">
                Focus Engine v3.0 Quantitative Session Active
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: BRAIN / ADVERSARIAL CRO AI DECISIONS ─────────────────────────── */}
        {(activePage === 'overview' || activePage === 'brain') && (
          <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h3 className="font-black text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  <span>Adversarial CRO AI Decision Stream</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400">Rigorous 5-point disqualification gatekeeper auditing setups</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 text-[10px] sm:text-xs font-bold shrink-0">
                Live Audits
              </span>
            </div>

            <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {focusLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-600" />
                  Auditing 15m structure and 5m pullbacks for {focusedCoin}... CRO decisions will appear here.
                </div>
              ) : (
                focusLogs.slice(0, 30).map((log) => {
                  const isAction = log.action === 'LONG' || log.action === 'SHORT';
                  const isWarning = log.action === 'WARN' || log.action === 'VETO';
                  return (
                    <div
                      key={log.id}
                      className={`p-2.5 sm:p-3 rounded-xl border text-xs transition-all ${
                        isAction
                          ? 'bg-slate-900 border-cyan-500/40'
                          : isWarning
                          ? 'bg-slate-950/80 border-amber-500/30'
                          : 'bg-slate-950/50 border-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] sm:text-[10px] font-black uppercase ${
                            log.action === 'LONG'
                              ? 'bg-emerald-500 text-slate-950'
                              : log.action === 'SHORT'
                              ? 'bg-rose-500 text-white'
                              : isWarning
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {log.action || 'SIGNAL'}
                          </span>
                          <span className="font-extrabold text-white text-xs">{log.symbol}</span>
                          {log.tier && (
                            <span className="text-[9px] text-slate-400 bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                              Tier {log.tier}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {formatIndianDateTime(log.created_at)}
                        </span>
                      </div>

                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {log.message}
                      </p>

                      {log.llm_source && (
                        <div className="mt-1 text-[9px] sm:text-[10px] text-indigo-400 font-medium flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          <span>{log.llm_source}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ─── TAB: TRADE LEDGER / HISTORY ──────────────────────────────────────── */}
        {(activePage === 'overview' || activePage === 'ledger' || activePage === 'trades') && (
          <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-4 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3 sm:mb-4">
              <div>
                <h3 className="font-black text-white text-sm sm:text-base md:text-lg flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                  <span>Trade Ledger</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400">Past closed positions with dual currency and audit trail</p>
              </div>

              {/* Direction Filters */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850 text-xs self-start sm:self-auto">
                {(['ALL', 'LONG', 'SHORT'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-2.5 py-0.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      selectedFilter === filter
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {filteredClosedTrades.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-850/50 p-6">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/80 animate-bounce" />
                <div className="text-white font-bold text-sm">v3.0 Clean Slate Active</div>
                <p className="mt-1 text-slate-400 max-w-sm mx-auto">
                  0 past trades in this active session. The engine is monitoring 15m structural setups with Adversarial CRO validation.
                </p>
                <div className="mt-3">
                  <button
                    onClick={() => setSelectedSessionId('session_v2_baseline_24h')}
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                  >
                    <span>View Archived v2.0 Baseline (215 Trades)</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Mobile View: High Polish Touch Cards */}
                <div className="grid grid-cols-1 md:hidden gap-2.5">
                  {filteredClosedTrades.map((t) => {
                    const pnl = parseFloat((t.realized_pnl as any) || '0');
                    const isWin = pnl >= 0;
                    const entry = parseFloat(t.entry_price as any);
                    const exit = parseFloat((t.exit_price as any) || '0');

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTrade(t)}
                        className="bg-slate-950 p-3 sm:p-3.5 rounded-2xl border border-slate-850 hover:border-cyan-500/50 hover:bg-slate-900/60 space-y-2 cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase ${t.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                              {t.position_side}
                            </span>
                            <span className="font-extrabold text-white text-xs group-hover:text-cyan-300 transition-colors">{t.symbol}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" /> Audit
                            </span>
                            <div className={`font-black text-xs sm:text-sm ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}{formatUSD(pnl)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-900">
                          <div>
                            <span className="text-slate-500 text-[10px]">Entry: </span>
                            <span className="text-white font-bold">{formatUSD(entry)}</span>
                            <div className="text-[9px] text-slate-400">{formatINR(entry, inrRate)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">Exit: </span>
                            <span className="text-white font-bold">{formatUSD(exit)}</span>
                            <div className="text-[9px] text-slate-400">{formatINR(exit, inrRate)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                          <span className="bg-slate-900 px-1.5 py-0.2 rounded border border-slate-850 font-medium">
                            {t.exit_reason || 'CLOSED'}
                          </span>
                          <span>{formatIndianDateTime(t.closed_at || t.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Clean Structured Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 uppercase tracking-wider text-[10px]">
                        <th className="pb-3 font-bold">Asset & Side</th>
                        <th className="pb-3 font-bold">Entry Price</th>
                        <th className="pb-3 font-bold">Exit Price</th>
                        <th className="pb-3 font-bold">Realized P&L</th>
                        <th className="pb-3 font-bold">Reason</th>
                        <th className="pb-3 font-bold">Closed Time (IST)</th>
                        <th className="pb-3 font-bold text-right pr-2">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {filteredClosedTrades.map((t) => {
                        const pnl = parseFloat((t.realized_pnl as any) || '0');
                        const isWin = pnl >= 0;
                        const entry = parseFloat(t.entry_price as any);
                        const exit = parseFloat((t.exit_price as any) || '0');

                        return (
                          <tr
                            key={t.id}
                            onClick={() => setSelectedTrade(t)}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                            title="Click to view full Groq CRO AI Decision and confluence audit"
                          >
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                                  {t.position_side}
                                </span>
                                <span className="font-extrabold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                                  {t.symbol}
                                  <Sparkles className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5">
                              <div className="text-white font-bold">{formatUSD(entry)}</div>
                              <div className="text-[10px] text-slate-400">{formatINR(entry, inrRate)}</div>
                            </td>
                            <td className="py-2.5">
                              <div className="text-white font-bold">{formatUSD(exit)}</div>
                              <div className="text-[10px] text-slate-400">{formatINR(exit, inrRate)}</div>
                            </td>
                            <td className="py-2.5">
                              <div className={`font-black ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}{formatUSD(pnl)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {isWin ? '+' : ''}{formatINR(pnl, inrRate)}
                              </div>
                            </td>
                            <td className="py-2.5">
                              <span className="bg-slate-950 px-2 py-0.5 rounded text-[10px] border border-slate-850 font-medium text-slate-300">
                                {t.exit_reason || 'CLOSED'}
                              </span>
                            </td>
                            <td className="py-2.5 text-slate-400 text-[11px]">
                              {formatIndianDateTime(t.closed_at || t.created_at)}
                            </td>
                            <td className="py-2.5 text-right pr-2">
                              <span className="text-[11px] font-bold text-cyan-400 opacity-80 group-hover:opacity-100 group-hover:underline flex items-center justify-end gap-1">
                                <Sparkles className="w-3 h-3" /> AI CRO
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: AI KEY CLUSTER & API HEALTH ──────────────────────────────────── */}
        {activePage === 'apikeys' && (
          <div className="gemini-glass-card rounded-3xl p-4 sm:p-7 shadow-2xl animate-fadeIn">
            <ApiKeyHealthPanel isEmbedded={true} />
          </div>
        )}

        {/* ─── MODALS ───────────────────────────────────────────────────────────── */}
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          inrRate={inrRate}
        />

        <ApiKeyHealthModal
          isOpen={showKeyHealthModal}
          onClose={() => setShowKeyHealthModal(false)}
        />

        <ResetSessionModal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          currentTrades={trades}
          currentWalletBalance={walletBalance}
          inrRate={inrRate}
          onResetSuccess={() => {
            setSelectedSessionId('active');
          }}
        />
      </main>

      {/* ─── MOBILE BOTTOM NAVIGATION BAR (FIXED FOR SMARTPHONES) ─────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-slate-950/95 backdrop-blur-xl border-t border-slate-850 pb-safe shadow-2xl">
        <div className="flex items-center justify-around px-1 py-1">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'scanner', label: 'Scanner', icon: Eye },
            { id: 'trades', label: 'Trades', icon: Coins, badge: openTrades.length },
            { id: 'brain', label: 'AI Brain', icon: Bot },
            { id: 'apikeys', label: 'AI Keys', icon: Cpu },
            { id: 'ledger', label: 'Ledger', icon: BookOpen },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActivePage(item.id as DashboardPage);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`bottom-nav-item touch-target cursor-pointer ${isActive ? 'active text-cyan-400' : 'text-slate-500'}`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-cyan-500 text-slate-950 font-black text-[8px] flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[9px] font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
