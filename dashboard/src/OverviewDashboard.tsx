import { useState } from 'react';
import { useGlobalStore } from './store/useGlobalStore';
import type { DashboardPage } from './store/useGlobalStore';
import { useSupabaseStream } from './hooks/useSupabaseStream';
import { useBitgetLivePrice } from './hooks/useBitgetLivePrice';
import { TradeDetailModal } from './components/TradeDetailModal';
import { ResetSessionModal } from './components/ResetSessionModal';
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
} from 'lucide-react';

export function OverviewDashboard() {
  useSupabaseStream();
  useBitgetLivePrice();

  const {
    trades,
    focusLogs,
    engineStatus,
    telemetry,
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
  const equityCurveData = [
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
  ];

  // Live Indicators from Engine Status (or default fallback)
  const liveInd = engineStatus?.live_indicators || {
    rsi: 58.4,
    adx: 22.1,
    chop: 43.8,
    vwap: 0.1538,
    mtf: 'BULLISH',
    atr: 0.0042,
    volZ: 1.25,
    price: 0.1542,
  };

  const focusedCoin = engineStatus?.focused_symbol || 'Scanning...';
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24 md:pb-12 antialiased selection:bg-cyan-500/20">
      {/* ─── STICKY HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-xl border-b border-slate-850 px-4 py-3 md:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-wider text-base md:text-lg bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  FOCUS ENGINE
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-700/50">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Cloud AI Focus Trading · Groq 5-Key Rotation Array
              </p>
            </div>
          </div>

          {/* Currency Pill & Session Controls & Status */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Live INR Conversion Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-300 shadow-sm">
              <span className="text-amber-400 font-bold">1 USDT</span>
              <span className="text-slate-500">≈</span>
              <span className="text-emerald-400 font-bold">₹{inrRate.toFixed(2)}</span>
            </div>

            {/* Session / Snapshot Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <Archive className="w-3.5 h-3.5 text-cyan-400 hidden sm:inline" />
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-bold focus:outline-none cursor-pointer max-w-[120px] sm:max-w-[190px] truncate"
              >
                <option value="active" className="bg-slate-900 text-emerald-400 font-bold">🟢 Active Live Session</option>
                {sessions.map((s, idx) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-slate-200">
                    📦 {s.name || `Snapshot #${idx + 1}`} ({s.total_trades}T · {s.total_pnl >= 0 ? '+' : ''}${s.total_pnl})
                  </option>
                ))}
                <option value="all" className="bg-slate-900 text-indigo-300 font-bold">📚 All-Time Combined</option>
              </select>
            </div>

            {/* Reset Session Button */}
            <button
              onClick={() => setShowResetModal(true)}
              title="Archive current session trades and reset to $10.00 capital & Cycle #1"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Live Status Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm shadow-emerald-950/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="tracking-wide hidden sm:inline">24/7 ACTIVE</span>
              <span className="tracking-wide sm:hidden">LIVE</span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="max-w-7xl mx-auto hidden md:flex items-center gap-1 mt-3 pt-2 border-t border-slate-900">
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
            { id: 'scanner', label: 'Live Coin Scanner', icon: Eye },
            { id: 'trades', label: 'Active Positions', icon: Coins, count: openTrades.length },
            { id: 'brain', label: 'Groq AI Decisions', icon: Bot },
            { id: 'ledger', label: 'Trade Ledger', icon: BookOpen, count: closedTrades.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activePage === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id as DashboardPage)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
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
      </header>

      {/* ─── MAIN CONTENT CONTAINER ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 mt-5 space-y-5">
        {/* ─── HISTORICAL SNAPSHOT BANNER (IF VIEWING ARCHIVED SESSION) ───────────── */}
        {selectedSessionId !== 'active' && (
          <div className="bg-gradient-to-r from-amber-950/70 via-slate-900/90 to-amber-950/70 border border-amber-500/40 text-amber-200 px-4 py-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Archive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black block">
                  Viewing Historical Snapshot: {selectedSession?.name || (selectedSessionId === 'all' ? 'All-Time Combined Ledger' : 'Archived Snapshot')}
                </span>
                <span className="text-[11px] text-amber-300/80">
                  {selectedSession ? `Archived with ${selectedSession.total_trades} trades · P&L: ${selectedSession.total_pnl >= 0 ? '+' : ''}$${selectedSession.total_pnl}` : 'All historical snapshots and active trades combined.'}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedSessionId('active')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow cursor-pointer active:scale-95"
            >
              Return to Live Active Session ➔
            </button>
          </div>
        )}

        {/* ─── TELEMETRY TICKER BAR ────────────────────────────────────────────── */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Eye className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <span>Current Focus Coin</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              </div>
              <div className="text-sm font-extrabold text-white flex items-center gap-2">
                <span>{focusedCoin}</span>
                <span className="text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40 font-mono font-bold">
                  Cycle #{cycleCount}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline font-normal">
                  · 5m momentum rotation active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Indicator Strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1.5">
              <span>RSI:</span>
              <span className={liveInd.rsi > 65 ? 'text-rose-400' : liveInd.rsi < 35 ? 'text-emerald-400' : 'text-cyan-400'}>
                {liveInd.rsi?.toFixed(1) || '50.0'}
              </span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1.5">
              <span>ADX:</span>
              <span className={liveInd.adx > 25 ? 'text-emerald-400' : 'text-amber-400'}>
                {liveInd.adx?.toFixed(1) || '20.0'}
              </span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1.5">
              <span>CHOP:</span>
              <span className={liveInd.chop > 61.8 ? 'text-rose-400' : 'text-emerald-400'}>
                {liveInd.chop?.toFixed(1) || '42.0'}
              </span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-850 font-bold text-slate-300 flex items-center gap-1.5">
              <span>5M MTF:</span>
              <span className={liveInd.mtf === 'BULLISH' ? 'text-emerald-400' : liveInd.mtf === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'}>
                {liveInd.mtf || 'NEUTRAL'}
              </span>
            </span>

            <span className="px-2.5 py-1 rounded-lg bg-indigo-950/40 border border-indigo-500/30 font-bold text-indigo-300">
              Groq 5-Key Array
            </span>
          </div>
        </div>

        {/* ─── 4 TOP STAT CARDS (DUAL CURRENCY: USD + INR) ───────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {/* Card 1: Balance */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
              <span>WALLET BALANCE</span>
              <DollarSign className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-white tracking-tight">
              {formatUSD(displayBalance)}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                {formatINR(displayBalance, inrRate)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Virtual Capital</span>
            </div>
          </div>

          {/* Card 2: Net Realized PnL */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
              <span>NET REALIZED PNL</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className={`text-xl md:text-2xl font-black tracking-tight ${displayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {displayPnl >= 0 ? '+' : ''}{formatUSD(displayPnl)}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`text-xs font-extrabold px-2 py-0.5 rounded border ${displayPnl >= 0 ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40' : 'text-rose-400 bg-rose-950/60 border-rose-800/40'}`}>
                {displayPnl >= 0 ? '+' : ''}{formatINR(displayPnl, inrRate)}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">{totalClosed} closed trades</span>
            </div>
          </div>

          {/* Card 3: Win Rate */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
              <span>WIN RATE</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-white tracking-tight">
              {winRate}%
            </div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium">
              <span className="text-emerald-400 font-bold">{winningTrades.length}W</span> · <span className="text-rose-400 font-bold">{losingTrades.length}L</span> · PF: <span className="text-white font-bold">{profitFactor}</span>
            </div>
          </div>

          {/* Card 4: Active Positions */}
          <div className="bg-slate-900/70 border border-slate-850 hover:border-slate-800 rounded-2xl p-4 shadow-lg transition-all">
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-2">
              <span>ACTIVE POSITION</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-white tracking-tight">
              {openTrades.length} Open
            </div>
            <div className="mt-1 text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <span className="text-amber-400 font-bold">5x Leverage</span>
              <span>· 10% Dynamic Risk</span>
            </div>
          </div>
        </div>

        {/* ─── ACTIVE OPEN POSITION CARD (IF TRADE OPEN) ───────────────────────── */}
        {openTrades.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Live Active Futures Position</span>
            </h2>
            {openTrades.map((pos) => {
              const livePrice = livePrices[pos.symbol] || parseFloat(pos.entry_price as any);
              const entry = parseFloat(pos.entry_price as any);
              const amount = pos.amount;
              const pnl = pos.position_side === 'LONG' ? (livePrice - entry) * amount : (entry - livePrice) * amount;
              const roi = entry > 0 ? ((pnl / (entry * amount / 5)) * 100).toFixed(2) : '0.00';
              const isProfit = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-emerald-500/40 rounded-3xl p-5 md:p-6 shadow-2xl relative overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black tracking-wider uppercase ${pos.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-md shadow-rose-500/20'}`}>
                        {pos.position_side} 5X
                      </span>
                      <div>
                        <div className="text-lg md:text-xl font-black text-white">{pos.symbol}</div>
                        <div className="text-[11px] text-slate-400">Opened: {formatIndianDateTime(pos.created_at)}</div>
                      </div>
                    </div>

                    {/* Live Unrealized PnL */}
                    <div className="text-right">
                      <div className="text-xs text-slate-400 font-semibold">Unrealized P&L</div>
                      <div className={`text-xl md:text-2xl font-black ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}{formatUSD(pnl)}
                        <span className="text-sm ml-1 font-bold">({roi}%)</span>
                      </div>
                      <div className="text-xs font-bold text-slate-300">
                        {isProfit ? '+' : ''}{formatINR(pnl, inrRate)}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                      <div className="text-slate-500 font-semibold mb-1">Entry Price</div>
                      <div className="text-white font-bold">{formatUSD(entry)}</div>
                      <div className="text-[10px] text-slate-400">{formatINR(entry, inrRate)}</div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                      <div className="text-slate-500 font-semibold mb-1">Current Mark Price</div>
                      <div className="text-cyan-400 font-bold">{formatUSD(livePrice)}</div>
                      <div className="text-[10px] text-slate-400">{formatINR(livePrice, inrRate)}</div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                      <div className="text-slate-500 font-semibold mb-1">Target / ATR Stop</div>
                      <div className="text-emerald-400 font-bold">
                        TP: {pos.take_profit_price ? formatUSD(pos.take_profit_price) : '+6.0%'}
                      </div>
                      <div className="text-rose-400 text-[10px] font-bold">
                        SL: {pos.stop_loss_price ? formatUSD(pos.stop_loss_price) : 'ATR Trailing Stop'}
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-850">
                      <div className="text-slate-500 font-semibold mb-1">Position Size</div>
                      <div className="text-white font-bold">{amount.toFixed(2)} {pos.symbol.replace('USDT', '')}</div>
                      <div className="text-[10px] text-slate-400">{formatUSD(amount * entry)} Notional</div>
                    </div>
                  </div>

                  {/* Audit Button */}
                  <button
                    onClick={() => setSelectedTrade(pos)}
                    className="mt-3.5 w-full py-2.5 px-4 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-2xl text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>View Live Groq AI Reasoning & Indicator Confluence</span>
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          /* When no active position, show Live Scanner & Radar Card */
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-black text-base md:text-lg text-white">Live Market Scanner Telemetry</h3>
                </div>
                <p className="text-xs text-slate-400">
                  Targeting volatile Bitget futures with 1m + 5m multi-timeframe alignment & CHOP filters.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-400 text-xs font-bold">
                  Target: {focusedCoin}
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                  {formatUSD(liveInd.price || 0)} ({formatINR(liveInd.price || 0, inrRate)})
                </span>
              </div>
            </div>

            {/* Indicator Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-5">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">RSI (14)</div>
                <div className={`text-base font-black mt-1 ${liveInd.rsi > 65 ? 'text-rose-400' : liveInd.rsi < 35 ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {liveInd.rsi?.toFixed(1) || '—'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.rsi > 65 ? 'Overbought' : liveInd.rsi < 35 ? 'Oversold' : 'Neutral Zone'}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">ADX Trend</div>
                <div className={`text-base font-black mt-1 ${liveInd.adx > 25 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {liveInd.adx?.toFixed(1) || '—'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.adx > 25 ? 'Strong Trend' : 'Moderate Flow'}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">CHOP Index</div>
                <div className={`text-base font-black mt-1 ${liveInd.chop > 61.8 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {liveInd.chop?.toFixed(1) || '—'}
                </div>
                <div className="text-[10px] text-slate-500">{liveInd.chop > 61.8 ? 'Consolidation' : 'Directional Clean'}</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">VWAP Status</div>
                <div className="text-base font-black text-white mt-1">
                  {formatUSD(liveInd.vwap || liveInd.price || 0)}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold">Institutional Benchmark</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">5M MTF Trend</div>
                <div className={`text-base font-black mt-1 ${liveInd.mtf === 'BULLISH' ? 'text-emerald-400' : liveInd.mtf === 'BEARISH' ? 'text-rose-400' : 'text-slate-400'}`}>
                  {liveInd.mtf || 'NEUTRAL'}
                </div>
                <div className="text-[10px] text-slate-500">Macro Trend Filter</div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                <div className="text-[10px] text-slate-500 font-bold uppercase">ATR Swing</div>
                <div className="text-base font-black text-white mt-1">
                  {formatUSD(liveInd.atr || 0)}
                </div>
                <div className="text-[10px] text-slate-400">{formatINR(liveInd.atr || 0, inrRate)} Volatility</div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: OVERVIEW (Charts & Performance) ──────────────────────────────── */}
        {(activePage === 'overview' || activePage === 'scanner') && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Equity Curve Chart */}
            <div className="lg:col-span-2 bg-slate-900/60 border border-slate-850 rounded-3xl p-5 md:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-white text-base md:text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                    <span>Cumulative P&L Curve</span>
                  </h3>
                  <p className="text-xs text-slate-400">Real-time compounding performance in USD & INR</p>
                </div>
                <div className="text-right">
                  <div className={`font-black text-base md:text-lg ${telemetry.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {telemetry.realizedPnl >= 0 ? '+' : ''}{formatUSD(telemetry.realizedPnl)}
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    {telemetry.realizedPnl >= 0 ? '+' : ''}{formatINR(telemetry.realizedPnl, inrRate)}
                  </div>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equityCurveData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#090d16',
                        borderColor: '#1e293b',
                        borderRadius: '12px',
                        fontSize: '12px',
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
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#22d3ee', stroke: '#0f172a', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#38bdf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quantitative Risk Breakdown */}
            <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 md:p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h3 className="font-black text-white text-base md:text-lg flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Quantitative Risk Guard</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">Live risk management parameters</p>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400">Profit Factor</span>
                    <span className="font-black text-white text-sm">{profitFactor}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400">Average Win</span>
                    <div className="text-right">
                      <span className="font-black text-emerald-400 text-sm">+{formatUSD(avgWin)}</span>
                      <div className="text-[10px] text-slate-400">+{formatINR(avgWin, inrRate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400">Average Loss</span>
                    <div className="text-right">
                      <span className="font-black text-rose-400 text-sm">-{formatUSD(avgLoss)}</span>
                      <div className="text-[10px] text-slate-400">-{formatINR(avgLoss, inrRate)}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <span className="text-slate-400">Dynamic ATR Breakeven</span>
                    <span className="font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                      Active (+1.0 ATR)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-850 text-[11px] text-slate-500 text-center">
                Clean Slate Mode · Fresh Baseline
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: BRAIN / GROQ AI DECISIONS ───────────────────────────────────── */}
        {(activePage === 'overview' || activePage === 'brain') && (
          <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-black text-white text-base md:text-lg flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-400" />
                  <span>Groq AI Decision & Signal Stream</span>
                </h3>
                <p className="text-xs text-slate-400">Every 1m candle evaluation, AI consensus, and quantitative reason</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-700/50 text-indigo-300 text-xs font-bold">
                Live Stream
              </span>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {focusLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-600" />
                  Observing live candles for {focusedCoin}... New candle decisions will appear here.
                </div>
              ) : (
                focusLogs.slice(0, 30).map((log) => {
                  const isAction = log.action === 'LONG' || log.action === 'SHORT';
                  const isWarning = log.action === 'WARN' || log.action === 'VETO';
                  return (
                    <div
                      key={log.id}
                      className={`p-3 rounded-2xl border text-xs transition-all ${
                        isAction
                          ? 'bg-slate-900 border-cyan-500/40'
                          : isWarning
                          ? 'bg-slate-950/80 border-amber-500/30'
                          : 'bg-slate-950/50 border-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
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
                          <span className="font-extrabold text-white">{log.symbol}</span>
                          {log.tier && (
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
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
                        <div className="mt-1 text-[10px] text-indigo-400 font-medium flex items-center gap-1">
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
          <div className="bg-slate-900/60 border border-slate-850 rounded-3xl p-5 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-black text-white text-base md:text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                  <span>Trade Ledger (Past Closed Positions)</span>
                </h3>
                <p className="text-xs text-slate-400">Complete historical audit trail with Indian timestamps and dual rates</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850 text-xs">
                {(['ALL', 'LONG', 'SHORT'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
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
              <div className="py-12 text-center text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                No closed trades yet in clean slate mode.
                <p className="mt-1 text-slate-600">Trades executed by the engine will automatically populate here in real-time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Mobile View: Cards */}
                <div className="grid grid-cols-1 md:hidden gap-3">
                  {filteredClosedTrades.map((t) => {
                    const pnl = parseFloat((t.realized_pnl as any) || '0');
                    const isWin = pnl >= 0;
                    const entry = parseFloat(t.entry_price as any);
                    const exit = parseFloat((t.exit_price as any) || '0');

                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTrade(t)}
                        className="bg-slate-950 p-4 rounded-2xl border border-slate-850 hover:border-cyan-500/50 hover:bg-slate-900/60 space-y-2.5 cursor-pointer transition-all active:scale-[0.99] group shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                              {t.position_side}
                            </span>
                            <span className="font-extrabold text-white text-sm group-hover:text-cyan-300 transition-colors">{t.symbol}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-0.5">
                              <Sparkles className="w-3 h-3" /> Audit
                            </span>
                            <div className={`font-black text-sm ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isWin ? '+' : ''}{formatUSD(pnl)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-900">
                          <div>
                            <span className="text-slate-500">Entry: </span>
                            <span className="text-white font-bold">{formatUSD(entry)}</span>
                            <div className="text-[10px] text-slate-400">{formatINR(entry, inrRate)}</div>
                          </div>
                          <div>
                            <span className="text-slate-500">Exit: </span>
                            <span className="text-white font-bold">{formatUSD(exit)}</span>
                            <div className="text-[10px] text-slate-400">{formatINR(exit, inrRate)}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1 text-slate-500">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-850 font-medium">
                            {t.exit_reason || 'CLOSED'}
                          </span>
                          <span>{formatIndianDateTime(t.closed_at || t.created_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[10px]">
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
                            title="Click to view full Groq AI Decision and indicators audit"
                          >
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${t.position_side === 'LONG' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'}`}>
                                  {t.position_side}
                                </span>
                                <span className="font-extrabold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1.5">
                                  {t.symbol}
                                  <Sparkles className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <div className="text-white font-bold">{formatUSD(entry)}</div>
                              <div className="text-[10px] text-slate-400">{formatINR(entry, inrRate)}</div>
                            </td>
                            <td className="py-3">
                              <div className="text-white font-bold">{formatUSD(exit)}</div>
                              <div className="text-[10px] text-slate-400">{formatINR(exit, inrRate)}</div>
                            </td>
                            <td className="py-3">
                              <div className={`font-black ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isWin ? '+' : ''}{formatUSD(pnl)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400">
                                {isWin ? '+' : ''}{formatINR(pnl, inrRate)}
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="bg-slate-950 px-2 py-0.5 rounded text-[10px] border border-slate-850 font-medium text-slate-300">
                                {t.exit_reason || 'CLOSED'}
                              </span>
                            </td>
                            <td className="py-3 text-slate-400 text-[11px]">
                              {formatIndianDateTime(t.closed_at || t.created_at)}
                            </td>
                            <td className="py-3 text-right pr-2">
                              <span className="text-[11px] font-bold text-cyan-400 opacity-80 group-hover:opacity-100 group-hover:underline flex items-center justify-end gap-1">
                                <Sparkles className="w-3 h-3" /> Groq AI
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

        {/* ─── MODALS ───────────────────────────────────────────────────────────── */}
        <TradeDetailModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          inrRate={inrRate}
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
        <div className="flex items-center justify-around px-2 py-1">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'scanner', label: 'Scanner', icon: Eye },
            { id: 'trades', label: 'Trades', icon: Coins, badge: openTrades.length },
            { id: 'brain', label: 'AI Brain', icon: Bot },
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
                  <Icon className="w-5 h-5" />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-cyan-500 text-slate-950 font-black text-[9px] flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-bold tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
