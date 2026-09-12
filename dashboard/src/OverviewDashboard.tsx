import { useState } from 'react';
import { useGlobalStore } from './store/useGlobalStore';
import type { FocusLog, FuturesTrade, DashboardPage } from './store/useGlobalStore';
import { useSupabaseStream } from './hooks/useSupabaseStream';
import { useBitgetLivePrice } from './hooks/useBitgetLivePrice';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, CartesianGrid
} from 'recharts';
import {
  LayoutDashboard,
  Bot,
  BookOpen,
  Activity,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Cpu,
  Search,
  Wallet,
  Percent,
  Coins,
  X,
  ArrowLeft,
  Timer,
  BarChart2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

/**
 * Calendar View helper component for the Bitget Futures Ledger page.
 */
function CalendarView({ trades, onSelectDate, selectedDate }: {
  trades: FuturesTrade[];
  onSelectDate: (dateStr: string | null) => void;
  selectedDate: string | null;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const prefixEmptyDays = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Group trades by date (YYYY-MM-DD)
  const tradesByDate: Record<string, FuturesTrade[]> = {};
  for (const t of trades) {
    if (t.created_at) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!tradesByDate[key]) tradesByDate[key] = [];
      tradesByDate[key].push(t);
    }
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-white text-sm">{monthNames[month]} {year}</h3>
        <div className="flex gap-1.5">
          <button onClick={prevMonth} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs select-none cursor-pointer">&lt;</button>
          <button onClick={nextMonth} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs select-none cursor-pointer">&gt;</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-500 mb-2">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {prefixEmptyDays.map((_, i) => (
          <div key={`empty-${i}`} className="h-9" />
        ))}
        {daysArray.map((day) => {
          const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTrades = tradesByDate[dateKey] || [];
          const hasProfit = dayTrades.some(t => parseFloat(t.realized_pnl as any) > 0);
          const hasLoss = dayTrades.some(t => parseFloat(t.realized_pnl as any) < 0);
          
          let borderStyle = 'border-slate-850';
          let bgStyle = 'bg-slate-950/30 hover:bg-slate-800/30';
          let dotColor = '';

          if (dateKey === selectedDate) {
            borderStyle = 'border-cyan-400';
            bgStyle = 'bg-cyan-950/30';
          } else if (dayTrades.length > 0) {
            borderStyle = 'border-cyan-500/30';
            bgStyle = 'bg-cyan-950/10 hover:bg-cyan-900/20';
            dotColor = hasProfit ? 'bg-emerald-400' : (hasLoss ? 'bg-rose-500' : 'bg-slate-400');
          }

          return (
            <button
              key={day}
              onClick={() => onSelectDate(dayTrades.length > 0 ? dateKey : null)}
              className={`h-9 flex flex-col items-center justify-between p-1 border rounded-lg transition-all duration-350 cursor-pointer ${borderStyle} ${bgStyle}`}
            >
              <span className="text-[9px] font-bold text-slate-300">{day}</span>
              {dotColor && <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  useSupabaseStream();
  useBitgetLivePrice();

  const {
    focusLogs,
    trades,
    healthEvents,
    telemetry,
    safeModeActive,
    setSafeModeActive,
    activePage,
    setActivePage,
    walletBalance,
    livePrices,
    engineStatus,
  } = useGlobalStore();

  const [selectedLog, setSelectedLog] = useState<FocusLog | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'FAILED' | 'PROFIT' | 'LOSS'>('ALL');
  const [selectedTrade, setSelectedTrade] = useState<FuturesTrade | null>(null);

  // Find the linked candidate for the selected trade (via pipeline_candidate_id or symbol+timestamp)
  const linkedCandidate: FocusLog | null = selectedTrade
    ? (focusLogs.find(c => selectedTrade.pipeline_candidate_id && c.id === selectedTrade.pipeline_candidate_id)
      ?? focusLogs
          .filter(c => `${c.symbol}USDT` === selectedTrade.symbol)
          .sort((a, b) => Math.abs(new Date(a.created_at).getTime() - new Date(selectedTrade.created_at).getTime())
                        - Math.abs(new Date(b.created_at).getTime() - new Date(selectedTrade.created_at).getTime()))[0]
      ?? null)
    : null;
  
  // Interactive KPI Modals
  const [kpiModal, setKpiModal] = useState<'balance' | 'margin' | 'winrate' | 'pnl' | null>(null);

  // Group candidate stats
  const activeTrades = trades.filter(t => t.status === 'OPEN');
  const finishedTrades = trades.filter(t => t.status === 'CLOSED');
  
  // Calculate average profit
  const totalClosed = finishedTrades.length;
  const totalPnL = telemetry.realizedPnl;
  const avgPnL = totalClosed > 0 ? totalPnL / totalClosed : 0;

  // Filter focusLogs by search term
  const filteredLogs = focusLogs.filter(c => 
    c.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.event_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Compute Equity Curve and Advanced Risk Metrics
  const sortedClosedTrades = [...finishedTrades].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  
  let cumulativePnl = 0;
  let maxDrawdown = 0;
  let peakCumulative = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalWinPnl = 0;
  let totalLossPnl = 0;

  const equityData: { name: string; pnl: number; balance: number }[] = [{ name: 'Start', pnl: 0, balance: 10 }]; // Assuming $10 start

  const dailyPnlMap: Record<string, number> = {};

  sortedClosedTrades.forEach((t) => {
    const pnl = parseFloat((t.realized_pnl as any) || '0');
    cumulativePnl += pnl;
    
    if (cumulativePnl > peakCumulative) peakCumulative = cumulativePnl;
    const drawdown = peakCumulative - cumulativePnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;

    if (pnl > 0) {
      grossProfit += pnl;
      winCount++;
      totalWinPnl += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
      lossCount++;
      totalLossPnl += Math.abs(pnl);
    }

    const date = new Date(t.created_at || 0);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    const fullDateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    dailyPnlMap[fullDateKey] = (dailyPnlMap[fullDateKey] || 0) + pnl;

    equityData.push({
      name: dateStr,
      pnl: parseFloat(cumulativePnl.toFixed(4)),
      balance: parseFloat((10 + cumulativePnl).toFixed(4))
    });
  });

  const dailyPnlData = Object.keys(dailyPnlMap).sort().map(date => ({
    date,
    pnl: parseFloat(dailyPnlMap[date].toFixed(4))
  }));

  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0.00');
  const avgWin = winCount > 0 ? (totalWinPnl / winCount).toFixed(2) : '0.00';
  const avgLoss = lossCount > 0 ? (totalLossPnl / lossCount).toFixed(2) : '0.00';

  // Filter trades by search, calendar, and status tab
  const filteredTrades = trades.filter(t => {
    // Search Filter
    const matchesSearch = t.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Calendar Date Filter
    let matchesDate = true;
    if (selectedDate && t.created_at) {
      const d = new Date(t.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      matchesDate = k === selectedDate;
    }

    // Status Tab Filter
    let matchesStatus = true;
    if (ledgerStatusFilter === 'PROFIT') {
      matchesStatus = t.status === 'CLOSED' && parseFloat((t.realized_pnl as any) || '0') > 0;
    } else if (ledgerStatusFilter === 'LOSS') {
      matchesStatus = t.status === 'CLOSED' && parseFloat((t.realized_pnl as any) || '0') < 0;
    } else if (ledgerStatusFilter !== 'ALL') {
      matchesStatus = t.status === ledgerStatusFilter;
    }

    return matchesSearch && matchesDate && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-900 relative overflow-x-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/4 w-48 md:w-[500px] h-48 md:h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-48 md:w-[500px] h-48 md:h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Layout Container */}
      <div className="max-w-[1600px] mx-auto px-3 pt-4 pb-24 md:px-6 md:pt-6 md:pb-6">
        
        {/* Upper Telemetry/SaaS Ribbon */}
        {/* ─── HEADER ─── */}
        <header className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-3 md:p-5 mb-4 md:mb-6 shadow-2xl">
          {/* Row 1: Brand + Status + Mode Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center shrink-0">
                <span className="relative flex h-3 w-3 md:h-3.5 md:w-3.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${telemetry.websocketConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 md:h-3.5 md:w-3.5 ${telemetry.websocketConnected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </span>
              </div>
              <div>
                <h1 className="text-base md:text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 md:h-5 md:w-5 text-cyan-400 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
                  ANTIGRAVITY
                </h1>
                <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 hidden sm:block">Cloud AI Focus Engine (Groq 5-Key Array)</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Mode Switcher — compact on mobile */}
              <button
                onClick={() => setSafeModeActive(!safeModeActive)}
                className={`border px-2.5 py-1.5 md:px-4 md:py-2 rounded-xl text-[9px] md:text-[10px] font-bold tracking-wider uppercase transition-all duration-300 shadow-lg cursor-pointer flex items-center gap-1.5 ${
                  safeModeActive 
                    ? 'bg-amber-950/30 text-amber-400 border-amber-500/25 hover:bg-amber-950/50' 
                    : 'bg-rose-950/30 text-rose-400 border-rose-500/25 hover:bg-rose-950/50'
                }`}
              >
                {safeModeActive ? (
                  <>
                    <ShieldCheck className="h-3 w-3 md:h-3.5 md:w-3.5 text-amber-400" />
                    <span className="hidden sm:inline">Simulated</span>
                    <span className="sm:hidden">Sim</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 md:h-3.5 md:w-3.5 text-rose-400 animate-pulse" />
                    <span className="hidden sm:inline">Live Mode</span>
                    <span className="sm:hidden">Live</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Search + Desktop Nav */}
          <div className="flex items-center gap-3 mt-3">
            {/* Global Search Bar */}
            <div className="relative flex-1 md:max-w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>

            {/* Navigation Tabs — desktop only, mobile uses bottom bar */}
            <nav className="hidden md:flex bg-slate-950/80 p-1.5 border border-slate-850 rounded-xl gap-1 shrink-0">
              {(['overview', 'brain', 'ledger', 'health'] as DashboardPage[]).map((page) => {
                const Icon = page === 'overview' ? LayoutDashboard :
                             page === 'brain' ? Bot :
                             page === 'ledger' ? BookOpen : Activity;
                return (
                  <button
                    key={page}
                    onClick={() => setActivePage(page)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-300 cursor-pointer flex items-center gap-2 ${
                      activePage === page 
                        ? 'bg-slate-800 text-cyan-400 shadow-md border border-slate-700/50' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {page}
                  </button>
                );
              })}
            </nav>
          </div>
        </header>

        {/* -------------------- 1. OVERVIEW PAGE -------------------- */}
        {activePage === 'overview' && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            {/* Cloud Engine Telemetry Banner */}
            <div className="bg-gradient-to-r from-slate-900/90 via-indigo-950/40 to-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Cloud Engine Status</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {engineStatus?.is_running !== false ? '24/7 ACTIVE' : 'STANDBY'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Targeting: <span className="text-cyan-400 font-bold font-sans">{engineStatus?.focused_symbol || 'Scanning Bitget...'}</span> · Rotation Cycle #{engineStatus?.cycle_count || 1}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <span className="text-slate-500 text-[9px] uppercase block">Groq Cloud LLM</span>
                  <span className="text-indigo-400 font-bold text-[11px]">5-Key Auto-Rotation</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
                  <span className="text-slate-500 text-[9px] uppercase block">Accuracy Filter</span>
                  <span className="text-emerald-400 font-bold text-[11px]">1m + 5m MTF + ATR</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">

              {/* Card 1: Virtual Wallet Balance */}
              <div
                onClick={() => setKpiModal('balance')}
                className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 md:p-5 shadow-xl relative overflow-hidden cursor-pointer hover:border-cyan-500/30 transition-all duration-300 group"
              >
                <div className="absolute top-2.5 right-2.5 md:top-4 md:right-4 bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-slate-850 group-hover:bg-cyan-950/30 transition-colors">
                  <Wallet className="h-3.5 w-3.5 md:h-4 md:w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-tight">Balance</span>
                <div className="text-lg md:text-2xl font-black font-mono mt-1 text-white">${walletBalance.toFixed(2)}<span className="text-xs text-slate-400 ml-1 hidden md:inline">USDT</span></div>
                <p className="text-[9px] text-slate-400 mt-0.5 hidden md:block">Virtual compounding wallet</p>
                <p className="text-[9px] text-slate-400 mt-0.5 md:hidden">USDT</p>
              </div>

              {/* Card 2: Engaged Margin & Leverage */}
              <div
                onClick={() => setKpiModal('margin')}
                className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 md:p-5 shadow-xl relative overflow-hidden cursor-pointer hover:border-indigo-500/30 transition-all duration-300 group"
              >
                <div className="absolute top-2.5 right-2.5 md:top-4 md:right-4 bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-slate-850 group-hover:bg-indigo-950/30 transition-colors">
                  <Coins className="h-3.5 w-3.5 md:h-4 md:w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-tight">Margin</span>
                <div className="text-lg md:text-2xl font-black font-mono mt-1 text-indigo-400">${(activeTrades.length * walletBalance * 0.1).toFixed(2)}<span className="text-xs text-indigo-300 ml-0.5"> / 5x</span></div>
                <p className="text-[9px] text-slate-400 mt-0.5 hidden md:block">10% dynamic risk allocation</p>
                <p className="text-[9px] text-slate-400 mt-0.5 md:hidden">Leverage</p>
              </div>

              {/* Card 3: Realized PnL */}
              <div
                onClick={() => setKpiModal('pnl')}
                className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 md:p-5 shadow-xl relative overflow-hidden cursor-pointer hover:border-emerald-500/30 transition-all duration-300 group"
              >
                <div className="absolute top-2.5 right-2.5 md:top-4 md:right-4 bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-slate-850 group-hover:bg-emerald-950/30 transition-colors">
                  <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-tight">Net PnL</span>
                <div className={`text-lg md:text-2xl font-black font-mono mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5 hidden md:block">From {totalClosed} closed positions</p>
                <p className="text-[9px] text-slate-400 mt-0.5 md:hidden">{totalClosed} closed</p>
              </div>

              {/* Card 4: Metrics / Win Rate */}
              <div
                onClick={() => setKpiModal('winrate')}
                className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 md:p-5 shadow-xl relative overflow-hidden cursor-pointer hover:border-amber-500/30 transition-all duration-300 group"
              >
                <div className="absolute top-2.5 right-2.5 md:top-4 md:right-4 bg-slate-950/50 p-1.5 md:p-2 rounded-xl border border-slate-850 group-hover:bg-amber-950/30 transition-colors">
                  <Percent className="h-3.5 w-3.5 md:h-4 md:w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider block leading-tight">Win Rate</span>
                <div className="text-lg md:text-2xl font-black font-mono mt-1 text-amber-400">
                  {(telemetry.winRate * 100).toFixed(1)}%
                </div>
                <p className="text-[9px] text-slate-400 mt-0.5">{activeTrades.length} open / {trades.length} total</p>
              </div>
            </div>

            {/* Advanced Performance & Risk Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Equity Curve Chart */}
              <div className="lg:col-span-8 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-xl h-[350px] flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-indigo-400 rounded" /> Equity Curve (Cumulative PnL)
                  </h2>
                </div>
                <div className="flex-1 w-full min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={equityData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#38bdf8' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                      />
                      <Line type="monotone" dataKey="pnl" name="Net PnL" stroke="#0ea5e9" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0ea5e9', stroke: '#0f172a', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: Advanced Risk Metrics */}
              <div className="lg:col-span-4 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-3 bg-rose-400 rounded" /> Advanced Risk Metrics
                </h2>
                
                <div className="grid grid-cols-2 gap-3 flex-1">
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Profit Factor</span>
                    <span className={`text-xl font-mono font-bold mt-1 ${parseFloat(profitFactor) > 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>{profitFactor}</span>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Max Drawdown</span>
                    <span className="text-xl font-mono font-bold mt-1 text-rose-400">-${maxDrawdown.toFixed(2)}</span>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Win</span>
                    <span className="text-xl font-mono font-bold mt-1 text-emerald-400">${avgWin}</span>
                  </div>
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Loss</span>
                    <span className="text-xl font-mono font-bold mt-1 text-rose-400">-${avgLoss}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section: Split Ledger and Telemetry Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Scans Summary */}
              <div className="lg:col-span-7 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-cyan-400 rounded" /> Focus Event Feed
                  </h2>
                  <button onClick={() => setActivePage('brain')} className="text-[10px] text-cyan-400 hover:underline">View Cloud AI Brain</button>
                </div>

                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredLogs.slice(0, 8).map((token) => (
                    <div
                      key={token.id}
                      onClick={() => {
                        setSelectedLog(token);
                        setActivePage('brain');
                      }}
                      className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between hover:border-slate-700 transition-all duration-300 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">${token.symbol}</span>
                          <span className="text-[9px] font-mono text-slate-500">{'FOCUS-ENGINE'.substring(0, 8)}...</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono">
                          Regime: {'RISK_ON'} | Final Score: {token.tier ? token.tier.toFixed(1) : 'N/A'}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-1 rounded text-[9px] font-bold tracking-wider ${
                          token.action === 'APPROVE' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20' :
                          token.action === 'WARN' ? 'bg-amber-950/50 text-amber-400 border border-amber-500/20' :
                          'bg-rose-950/50 text-rose-400 border border-rose-500/20'
                        }`}>
                          {token.action}
                        </span>
                      </div>
                    </div>
                  ))}
                  {filteredLogs.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-12">No scanned candidate details logged yet.</p>
                  )}
                </div>
              </div>

              {/* Right: Active Trades ledger */}
              <div className="lg:col-span-5 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-indigo-400 rounded" /> Active Open Trades
                  </h2>
                  <button onClick={() => setActivePage('ledger')} className="text-[10px] text-indigo-400 hover:underline">View Trade Ledger</button>
                </div>

                <div className="flex flex-col gap-4 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
                  {activeTrades.map((t) => {
                    const baseSymbol = t.symbol.replace('USDT', '');
                    const entryPrice = t.entry_price ? parseFloat(t.entry_price as any) : 0;
                    const amount = parseFloat(t.amount as any);
                    
                    // Match live price from WebSocket or scanned focusLogs
                    const candidate = focusLogs.find(c => c.symbol === baseSymbol);
                    const markPrice = livePrices[t.symbol] || entryPrice;
                    
                    // Math calculations
                    const positionSizeUsdt = amount * entryPrice;
                    const marginUsdt = positionSizeUsdt / 5; // 5x Leverage
                    const unrealizedPnl = t.position_side === 'LONG' 
                      ? (markPrice - entryPrice) * amount 
                      : (entryPrice - markPrice) * amount;
                    
                    const roe = marginUsdt > 0 ? (unrealizedPnl / marginUsdt) * 100 : 0;
                    const estLiqPrice = t.position_side === 'LONG' ? entryPrice * 0.81 : entryPrice * 1.19;
                    const isProfit = unrealizedPnl >= 0;

                    // Dynamic Trailing Stop Loss & Take Profit calculations
                    const estimatedPeak = t.position_side === 'LONG' 
                      ? Math.max(entryPrice, markPrice) 
                      : Math.min(entryPrice, markPrice);
                    
                    const tpPrice = t.position_side === 'LONG' ? entryPrice * 1.05 : entryPrice * 0.95;
                    const slPrice = t.position_side === 'LONG' ? estimatedPeak * 0.98 : estimatedPeak * 1.02;

                    // Dynamic MMR Calculation:
                    // Maintenance Margin Ratio = (Maintenance Margin / Margin Balance) * 100.
                    // Base tier maintenance margin ratio for 5x leverage is ~0.828% (which yields exactly 4.14% starting MMR ratio at entry).
                    const baseMmrRatio = 0.00828;
                    const maintenanceMargin = amount * markPrice * baseMmrRatio;
                    const marginBalance = Math.max(0.01, marginUsdt + unrealizedPnl);
                    const mmrPercentage = (maintenanceMargin / marginBalance) * 100;

                    return (
                      <div key={t.id} onClick={() => setSelectedTrade(t)} className="bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-2xl hover:border-slate-700/60 hover:bg-slate-900/60 transition-all duration-300 flex flex-col gap-4 font-sans text-xs cursor-pointer group">
                        {/* Header: Symbol & Badges */}
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col gap-1.5">
                            <h4 className="font-extrabold text-white text-base tracking-wide flex items-center gap-1 cursor-pointer hover:text-cyan-400 transition-colors">
                              {baseSymbol}USDT <span className="text-slate-400 text-xs font-normal font-sans ml-0.5">&gt;</span>
                            </h4>
                            <div className="flex flex-wrap gap-1.5 mt-0.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                t.position_side === 'LONG' 
                                  ? 'bg-emerald-950/20 text-[#0ecb81] border-[#0ecb81]/30' 
                                  : 'bg-rose-950/20 text-[#f6465d] border-[#f6465d]/30'
                              }`}>
                                {t.position_side === 'LONG' ? 'Long' : 'Short'}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/50 border border-slate-800 text-cyan-400 font-mono">5x</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-950/50 border border-slate-800 text-slate-400 font-mono">Cross</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-950/50 border border-slate-800 text-slate-400 font-mono">USDT</span>
                              {candidate?.event_type && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 font-mono uppercase">
                                  Event: {candidate.event_type}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Right Side Icons: Candlesticks Chart and Share */}
                          <div className="flex items-center gap-3">
                            {/* Custom inline SVG Candlestick icon */}
                            <svg className="h-5 w-5 text-slate-400 hover:text-white transition-colors cursor-pointer" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <line x1="9" y1="2" x2="9" y2="22" />
                              <rect x="6" y="6" width="6" height="10" fill="currentColor" fillOpacity="0.2" rx="1" />
                              <line x1="15" y1="2" x2="15" y2="22" />
                              <rect x="12" y="8" width="6" height="6" fill="currentColor" fillOpacity="0.2" rx="1" />
                            </svg>
                            {/* Custom inline SVG Share icon */}
                            <svg className="h-5 w-5 text-slate-400 hover:text-white transition-colors cursor-pointer" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="18" cy="5" r="3" />
                              <circle cx="6" cy="12" r="3" />
                              <circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                          </div>
                          <div className="flex flex-col text-right">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">AI Event</span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {candidate?.event_type || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* First Row: Unrealized PnL & ROE */}
                        <div className="grid grid-cols-2 border-t border-slate-800/60 pt-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 font-medium border-b border-dashed border-slate-700/40 pb-0.5 w-max hover:text-slate-300 cursor-help" title="Unrealized Profit and Loss calculated based on mark price.">
                              Unrealized PnL (USDT)
                            </span>
                            <div className={`text-base font-extrabold font-mono tracking-tight flex items-baseline ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {isProfit ? '+' : ''}{unrealizedPnl.toFixed(4)}
                              <span className="text-[11px] font-medium text-slate-500 ml-1.5 font-sans relative top-[-1px]">
                                ≈ ₹{(unrealizedPnl * 87.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] text-slate-400 font-medium border-b border-dashed border-slate-700/40 pb-0.5 w-max hover:text-slate-300 cursor-help text-right" title="Return on Equity: Unrealized PnL divided by engaged margin.">
                              ROE
                            </span>
                            <div className={`text-base font-extrabold font-mono tracking-tight text-right ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {isProfit ? '+' : ''}{roe.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        {/* Second Row: Size, Margin, MMR */}
                        <div className="grid grid-cols-3 bg-slate-950/40 p-3 border border-slate-850 rounded-xl">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help flex items-center gap-0.5" title="The current size of this futures contract position.">
                              Size ({baseSymbol}) <span className="text-[7px] text-slate-500">▼</span>
                            </span>
                            <span className="text-xs font-bold text-slate-200 font-mono mt-0.5">{amount.toFixed(4)}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help" title="The margin currently allocated to keep this position open.">
                              Margin (USDT)
                            </span>
                            <span className="text-xs font-bold text-slate-200 font-mono mt-0.5">{marginUsdt.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help text-right" title="Maintenance Margin Ratio: Required margin to avoid liquidation.">
                              MMR
                            </span>
                            <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 text-right">{mmrPercentage.toFixed(2)}%</span>
                          </div>
                        </div>

                        {/* Third Row: Entry price, Mark price, Est liq price */}
                        <div className="grid grid-cols-3 text-xs text-slate-400 font-mono pt-1">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help" title="Average execution price where the trade was opened.">
                              Entry price
                            </span>
                            <span className="font-bold text-slate-300 mt-0.5">{entryPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help" title="The current reference price of this contract on the exchange.">
                              Mark price
                            </span>
                            <span className="font-bold text-slate-300 mt-0.5">{markPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help text-right" title="Estimated price level where the position will face liquidation.">
                              Est. liq. price
                            </span>
                            <span className="font-extrabold text-[#f0b90b] mt-0.5 text-right">{estLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                        </div>

                        {/* Fourth Row: TP price, SL price, Dynamic Trailing Peak */}
                        <div className="grid grid-cols-3 text-xs font-mono border-t border-slate-900/60 pt-3.5 mt-0.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help" title="Dynamic 5% Take Profit Target price.">
                              TP Price (5%)
                            </span>
                            <span className="font-bold text-[#0ecb81] mt-0.5">{tpPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help" title="Dynamic 2% Trailing Stop Loss price. Trails high for Longs and low for Shorts.">
                              SL Price (2% Trailing)
                            </span>
                            <span className="font-bold text-[#f6465d] mt-0.5">{slPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            <span className="text-[9px] text-slate-500 font-medium border-b border-dashed border-slate-800/80 pb-0.5 w-max hover:text-slate-400 cursor-help text-right" title="The maximum peak price achieved since position was opened. Used to trail stop-loss.">
                              Trailing Peak
                            </span>
                            <span className="font-bold text-slate-300 mt-0.5 text-right">{estimatedPeak.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                          </div>
                        </div>

                        {/* Bottom Row: Realized PnL Panel */}
                        <div className="bg-slate-950/50 rounded-xl px-3 py-2.5 flex justify-between items-center border border-slate-850/80 mt-0.5">
                          <span className="text-[10px] text-slate-500 font-medium border-b border-dashed border-slate-800/85 pb-0.5 hover:text-slate-400 cursor-help" title="Realized profit and loss of this position including fees.">
                            Realized PnL(USDT)
                          </span>
                          <span className={`text-xs font-bold font-mono ${parseFloat(t.realized_pnl as any) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                            {parseFloat(t.realized_pnl as any) >= 0 ? '+' : ''}{parseFloat(t.realized_pnl as any || '0').toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {activeTrades.length === 0 && (
                    <p className="text-center text-xs text-slate-500 py-12">No active open positions on Bitget.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 2. AGENT PIPELINE ANALYSER PAGE -------------------- */}
        {activePage === 'brain' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-fadeIn">
            {/* Scanned focusLogs list — hidden on mobile when a candidate is selected */}
            <div className={`lg:col-span-4 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xl ${
              selectedLog ? 'hidden lg:block' : 'block'
            }`}>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-1 h-3 bg-cyan-400 rounded" /> Candidates Scanned
              </h2>

              <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredLogs.map((token) => (
                  <div
                    key={token.id}
                    onClick={() => setSelectedLog(token)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
                      selectedLog?.id === token.id 
                        ? 'border-cyan-500 bg-slate-800/40 shadow-lg' 
                        : 'border-slate-850 bg-slate-950/20 hover:bg-slate-900/30 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-white text-sm">${token.symbol}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                        token.action === 'APPROVE' ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-500/20' :
                        token.action === 'WARN' ? 'bg-amber-950/50 text-amber-400 border border-amber-500/20' :
                        'bg-rose-950/50 text-rose-400 border border-rose-500/20'
                      }`}>
                        {token.action}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2 font-mono">
                      <span>Tier: {token.tier || 'N/A'}</span>
                      <span>{token.event_type}</span>
                    </div>
                  </div>
                ))}
                {filteredLogs.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-12">No scanner focusLogs found.</p>
                )}
              </div>
            </div>

            {/* Visual 7-Agent sequential graph — full width on mobile when candidate selected */}
            <div className={`lg:col-span-8 ${selectedLog ? 'block' : 'hidden lg:block'}`}>
              {selectedLog ? (
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col gap-5 md:gap-6 animate-fadeIn relative">
                  {/* Mobile: Back to focusLogs list */}
                  <button
                    className="lg:hidden flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-semibold mb-1 cursor-pointer"
                    onClick={() => setSelectedLog(null)}
                  >
                    <ChevronLeft className="h-4 w-4" /> All Candidates
                  </button>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Focus Scan: {selectedLog.symbol}</h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-mono">Logged at: {new Date(selectedLog.created_at).toLocaleString()}</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 uppercase">
                          Event: {selectedLog.event_type}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cloud AI Brain View */}
                  <div className="flex flex-col gap-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Groq Cloud AI Quantitative Brain</h3>
                    
                    {/* Technical Context */}
                    <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 flex flex-col gap-4 hover:border-slate-700 transition-colors duration-300">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs uppercase tracking-wider">Technical Context</span>
                        <span className="text-[9px] font-mono text-slate-400">Parsed Indicators & ATR</span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {selectedLog.indicators && Object.entries(selectedLog.indicators).map(([key, value]) => (
                          <div key={key} className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                            <div className="text-[8px] text-slate-500 font-semibold uppercase truncate">{key}</div>
                            <div className="text-xs font-bold mt-0.5 text-cyan-400 font-mono">
                              {typeof value === 'number' ? value.toFixed(4) : String(value)}
                            </div>
                          </div>
                        ))}
                        {!selectedLog.indicators && (
                          <div className="col-span-4 text-xs text-slate-500 italic">No technical context available for this log.</div>
                        )}
                      </div>
                    </div>

                    {/* LLM Reasoning */}
                    <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-4 flex flex-col gap-4 hover:border-slate-700 transition-colors duration-300">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-white text-xs uppercase tracking-wider">Cloud LLM Risk Reasoning</span>
                        <span className="text-[9px] font-mono text-emerald-400">Groq Array (openai/gpt-oss-20b)</span>
                      </div>
                      
                      <div className="bg-[#0f172a]/80 p-4 rounded-xl border border-slate-800/80 max-h-[300px] overflow-y-auto custom-scrollbar font-mono text-[10px] sm:text-xs text-slate-300 whitespace-pre-wrap leading-relaxed shadow-inner">
                        {selectedLog.llm_source || "No LLM reasoning captured."}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center py-24 text-slate-500">
                  <p className="text-sm">Select a focus log on the left to view the cloud AI's reasoning and indicators.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------- 3. FUTURES LEDGER PAGE -------------------- */}
        {activePage === 'ledger' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 animate-fadeIn">
            {/* Left side: interactive Calendar view */}
            <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6">
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-1 h-3 bg-cyan-400 rounded" /> Ledger Calendar View
                  </h2>
                  {selectedDate && (
                    <button onClick={() => setSelectedDate(null)} className="text-[10px] text-rose-400 hover:underline">Clear Filter</button>
                  )}
                </div>
                
                <CalendarView
                  trades={trades}
                  onSelectDate={setSelectedDate}
                  selectedDate={selectedDate}
                />
                
                <p className="text-[10px] text-slate-500 mt-4 leading-relaxed font-mono mb-6">
                  Days with active/closed trades are highlighted in blue. A green dot indicates profitable trades closed on that day; a red dot indicates losing trades closed on that day.
                </p>

                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <span className="w-1 h-3 bg-purple-400 rounded" /> Daily PnL (Closed Trades)
                </h2>
                <div className="w-full h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyPnlData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} tickFormatter={(val) => { const d = new Date(val); return `${d.getMonth()+1}/${d.getDate()}` }} />
                      <YAxis stroke="#64748b" fontSize={10} tickMargin={10} axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} />
                      <Tooltip
                        cursor={{ fill: '#0f172a' }}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', fontSize: '12px' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        formatter={(value: any) => [`$${value}`, 'Net PnL']}
                      />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {dailyPnlData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#34d399' : '#f87171'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right side: trade log table */}
            <div className="lg:col-span-7 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-3 md:p-5 shadow-xl flex flex-col min-h-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1 h-3 bg-indigo-400 rounded" /> Trade History Ledger {selectedDate ? `(${selectedDate})` : ''}
                </h2>
                
                {/* Status Filter Tabs */}
                <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-xl gap-1 overflow-x-auto custom-scrollbar">
                  {(['ALL', 'OPEN', 'CLOSED', 'FAILED', 'PROFIT', 'LOSS'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLedgerStatusFilter(filter)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 cursor-pointer whitespace-nowrap ${
                        ledgerStatusFilter === filter 
                          ? 'bg-slate-800 text-cyan-400 border border-slate-700/50' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile: Card list view */}
              <div className="flex flex-col gap-2 sm:hidden">
                {filteredTrades.map((t) => {
                  const pnl = t.realized_pnl ? parseFloat(t.realized_pnl as any) : 0;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTrade(t)}
                      className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 cursor-pointer active:bg-slate-900/80 transition-all"
                    >
                      {/* Row 1: Symbol + Status */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-white text-base">{t.symbol.replace('USDT', '')}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            t.position_side === 'LONG' ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950/70 text-rose-400 border border-rose-500/20'
                          }`}>{t.position_side}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'OPEN' ? 'text-cyan-400' :
                          t.status === 'CLOSED' ? 'text-slate-400' :
                          'text-rose-500'
                        }`}>{t.status}</span>
                      </div>
                      {/* Row 2: Prices */}
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 mb-2">
                        <span>Entry <span className="text-slate-200">${t.entry_price ? parseFloat(t.entry_price as any).toFixed(5) : '—'}</span></span>
                        {t.exit_price && (
                          <><span className="text-slate-600">→</span><span>Exit <span className="text-slate-200">${parseFloat(t.exit_price as any).toFixed(5)}</span></span></>
                        )}
                      </div>
                      {/* Row 3: PnL + Chevron */}
                      <div className="flex items-center justify-between">
                        <span className={`text-xl font-black font-mono ${
                          t.status === 'OPEN' ? 'text-cyan-400' :
                          pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {t.status === 'OPEN' ? 'Live ›' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}`}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </div>
                    </div>
                  );
                })}
                {filteredTrades.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-10 italic">No trades recorded for this period.</p>
                )}
              </div>

              {/* Desktop: Table view */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3 px-2">Symbol</th>
                      <th className="py-3 px-2">Skill</th>
                      <th className="py-3 px-2">Side</th>
                      <th className="py-3 px-2">Amount</th>
                      <th className="py-3 px-2">Entry</th>
                      <th className="py-3 px-2">Exit</th>
                      <th className="py-3 px-2">PnL</th>
                      <th className="py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((t) => {
                      const pnl = t.realized_pnl ? parseFloat(t.realized_pnl as any) : 0;
                      const candidate = focusLogs.find(cand => cand.id === t.pipeline_candidate_id || cand.symbol === t.symbol.replace('USDT', ''));
                      const skill = candidate?.event_type || 'Core Strategy';
                      return (
                        <tr
                          key={t.id}
                          onClick={() => setSelectedTrade(t)}
                          className="border-b border-slate-900 hover:bg-cyan-950/10 hover:border-cyan-900/30 transition-colors duration-200 font-mono cursor-pointer group"
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white group-hover:text-cyan-300 transition-colors">{t.symbol}</span>
                              <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                            </div>
                          </td>
                          <td className="py-3.5 px-2">
                            <span className="font-bold text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-900/50 text-[10px] truncate max-w-[100px] inline-block" title={skill}>
                              {skill}
                            </span>
                          </td>
                          <td className="py-3.5 px-2">
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${t.position_side === 'LONG' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-rose-950/50 text-rose-400'}`}>
                              {t.position_side}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 text-slate-300">{t.amount}</td>
                          <td className="py-3.5 px-2 text-slate-300">${t.entry_price ? parseFloat(t.entry_price as any).toFixed(4) : '-'}</td>
                          <td className="py-3.5 px-2 text-slate-300">${t.exit_price ? parseFloat(t.exit_price as any).toFixed(4) : '-'}</td>
                          <td className={`py-3.5 px-2 font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {t.status === 'CLOSED' ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '-'}
                          </td>
                          <td className="py-3.5 px-2">
                            <span className={`font-bold text-[10px] ${
                              t.status === 'OPEN' ? 'text-cyan-400 animate-pulse' :
                              t.status === 'CLOSED' ? 'text-slate-400' :
                              t.status === 'FAILED' ? 'text-rose-500' : 'text-amber-500'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredTrades.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500 italic">No trades recorded for this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------- 4. SYSTEM HEALTH LOGS PAGE -------------------- */}
        {activePage === 'health' && (
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 shadow-xl animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-rose-500 rounded" /> System Health Events & Audits
              </h2>
              <div className="text-[10px] text-slate-400 font-mono">
                API Status: {telemetry.websocketConnected ? 'Streaming Live' : 'Disconnected'}
              </div>
            </div>

            {/* Mobile: Card list */}
            <div className="flex flex-col gap-2 sm:hidden mb-2">
              {healthEvents.map((evt) => (
                <div key={evt.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-bold text-white text-xs leading-snug">{evt.event_type}</span>
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      evt.severity === 'ERROR' ? 'bg-rose-950/60 text-rose-400 border border-rose-500/20' :
                      evt.severity === 'WARNING' ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20' :
                      'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20'
                    }`}>{evt.severity}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed mb-2">{evt.message}</p>
                  <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                    <span>{evt.component}</span>
                    <span>{new Date(evt.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {healthEvents.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-10 italic">No health check logs recorded.</p>
              )}
            </div>

            {/* Desktop: Table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-semibold">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Event Type</th>
                    <th className="py-3 px-3">Component</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {healthEvents.map((evt) => (
                    <tr key={evt.id} className="border-b border-slate-900 hover:bg-slate-900/10 transition-colors duration-250 font-mono">
                      <td className="py-3.5 px-3 text-slate-400 text-[10px]">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-white font-bold">{evt.event_type}</td>
                      <td className="py-3.5 px-3 text-slate-300">{evt.component}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                          evt.severity === 'ERROR' ? 'bg-rose-950/60 text-rose-400 border border-rose-500/20' :
                          evt.severity === 'WARNING' ? 'bg-amber-950/60 text-amber-400 border border-amber-500/20' :
                          'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20'
                        }`}>
                          {evt.severity}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-slate-200 text-xs max-w-md truncate">{evt.message}</td>
                    </tr>
                  ))}
                  {healthEvents.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500 italic">No health check logs recorded in Supabase.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ==================== MOBILE BOTTOM NAVIGATION BAR ==================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/80 flex safe-area-inset-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {(['overview', 'brain', 'ledger', 'health'] as DashboardPage[]).map((page) => {
          const Icon = page === 'overview' ? LayoutDashboard :
                       page === 'brain' ? Bot :
                       page === 'ledger' ? BookOpen : Activity;
          const label = page === 'overview' ? 'Home' : page.charAt(0).toUpperCase() + page.slice(1);
          return (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`bottom-nav-item ${activePage === page ? 'active' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ==================== TRADE DETAIL FULL-PAGE OVERLAY ==================== */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-slate-950 z-50 overflow-y-auto animate-fadeIn">
          {/* Background FX */}
          <div className="absolute top-0 left-1/4 w-32 md:w-[600px] h-32 md:h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-32 md:w-[600px] h-32 md:h-[400px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-[1200px] mx-auto px-3 py-4 md:p-6 relative">

            {/* ─── Back Button & Title ─── */}
            <div className="flex items-center gap-3 mb-5 md:mb-8">
              <button
                onClick={() => setSelectedTrade(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 hover:border-slate-600 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Ledger
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-extrabold text-white tracking-tight">
                    Trade Detail — <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">{selectedTrade.symbol}</span>
                  </h1>
                  {(() => {
                    const tradeCandidate = focusLogs.find(c => c.symbol === selectedTrade.symbol.replace('USDT', ''));
                    return tradeCandidate?.event_type ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 font-mono uppercase mt-1">
                        Event: {tradeCandidate.event_type}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  ID: {selectedTrade.id} · Opened {new Date(selectedTrade.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* ─── Top Stats Row ─── */}
            {(() => {
              const pnl = parseFloat(selectedTrade.realized_pnl as any) || 0;
              const entryPrice = selectedTrade.entry_price ? parseFloat(selectedTrade.entry_price as any) : null;
              const exitPrice = selectedTrade.exit_price ? parseFloat(selectedTrade.exit_price as any) : null;
              const openedAt = new Date(selectedTrade.created_at);
              const closedAt = selectedTrade.closed_at ? new Date(selectedTrade.closed_at) : null;
              const durationMs = closedAt ? closedAt.getTime() - openedAt.getTime() : (Date.now() - openedAt.getTime());
              const durationMins = Math.floor(durationMs / 60000);
              const durationHrs = Math.floor(durationMins / 60);
              const durationLabel = durationHrs > 0 ? `${durationHrs}h ${durationMins % 60}m` : `${durationMins}m`;
              const isProfitable = pnl > 0;

              return (
                <>
                  {/* Main Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {/* Direction + Score */}
                    <div className="col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Position</div>
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-extrabold ${selectedTrade.position_side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {selectedTrade.position_side}
                          </span>
                          {selectedTrade.position_side === 'LONG'
                            ? <TrendingUp className="h-7 w-7 text-emerald-400" />
                            : <TrendingDown className="h-7 w-7 text-rose-400" />}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{selectedTrade.symbol} · 5x Leverage</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Status</div>
                        <span className={`text-sm font-bold px-3 py-1.5 rounded-xl border ${
                          selectedTrade.status === 'OPEN' ? 'bg-cyan-950/50 text-cyan-400 border-cyan-500/30 animate-pulse' :
                          selectedTrade.status === 'CLOSED' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                          'bg-rose-950/50 text-rose-400 border-rose-500/30'
                        }`}>{selectedTrade.status}</span>
                        {linkedCandidate && (
                          <div className="text-[10px] text-indigo-400 font-mono mt-2 font-bold">
                            Tier: {linkedCandidate.tier || 'N/A'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* PnL Card */}
                    <div className={`bg-slate-900/60 border rounded-2xl p-5 ${
                      selectedTrade.status === 'OPEN' ? 'border-cyan-500/20' :
                      isProfitable ? 'border-emerald-500/20 bg-emerald-950/10' : 'border-rose-500/20 bg-rose-950/10'
                    }`}>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2">Realized PnL</div>
                      <div className={`text-2xl font-extrabold font-mono ${
                        selectedTrade.status === 'OPEN' ? 'text-slate-400' :
                        isProfitable ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {selectedTrade.status === 'OPEN' ? 'Live' : `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(4)}`}
                      </div>
                      {entryPrice && exitPrice && (
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          Δ {((Math.abs(exitPrice - entryPrice) / entryPrice) * 100).toFixed(3)}%
                        </div>
                      )}
                    </div>

                    {/* Duration Card */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1">
                        <Timer className="h-3 w-3" /> Duration
                      </div>
                      <div className="text-xl font-extrabold font-mono text-white">{durationLabel}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">
                        {selectedTrade.status === 'OPEN' ? '⏳ Still running' : '✓ Completed'}
                      </div>
                    </div>
                  </div>

                  {/* Entry / Exit / Amount Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Entry Price</div>
                      <div className="text-sm font-bold font-mono text-white mt-1">
                        ${entryPrice ? entryPrice.toFixed(6) : '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Exit Price</div>
                      <div className="text-sm font-bold font-mono text-white mt-1">
                        ${exitPrice ? exitPrice.toFixed(6) : '—'}
                      </div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Contracts</div>
                      <div className="text-sm font-bold font-mono text-white mt-1">{selectedTrade.amount}</div>
                    </div>
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Closed At</div>
                      <div className="text-xs font-bold font-mono text-white mt-1">
                        {closedAt ? closedAt.toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>

                  {/* LLM Event Bar */}
                  {linkedCandidate && (
                    <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-4 mb-6 flex items-center gap-4">
                      <BarChart2 className="h-5 w-5 text-indigo-400 shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                          <span>AI Event</span>
                          <span className="font-bold text-white uppercase">{linkedCandidate.event_type}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                            style={{ width: `100%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Action: <span className="font-bold text-emerald-400">{linkedCandidate.action}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            {/* ─── LIVE MONITOR PANEL (OPEN trades only) ─── */}
            {selectedTrade.status === 'OPEN' && (() => {
              const baseSymbol = selectedTrade.symbol.replace('USDT', '');
              const ep = selectedTrade.entry_price ? parseFloat(selectedTrade.entry_price as any) : 0;
              const amt = parseFloat(selectedTrade.amount as any);
              const markPrice = livePrices[selectedTrade.symbol] || ep;
              const positionSizeUsdt = amt * ep;
              const marginUsdt = positionSizeUsdt / 5;
              const unrealizedPnl = selectedTrade.position_side === 'LONG'
                ? (markPrice - ep) * amt
                : (ep - markPrice) * amt;
              const roe = marginUsdt > 0 ? (unrealizedPnl / marginUsdt) * 100 : 0;
              const estLiqPrice = selectedTrade.position_side === 'LONG' ? ep * 0.81 : ep * 1.19;
              const estimatedPeak = selectedTrade.position_side === 'LONG'
                ? Math.max(ep, markPrice)
                : Math.min(ep, markPrice);
              const tpPrice = selectedTrade.position_side === 'LONG' ? ep * 1.016 : ep * 0.984;
              const slPrice = selectedTrade.position_side === 'LONG' ? estimatedPeak * 0.98 : estimatedPeak * 1.02;
              const baseMmrRatio = 0.00828;
              const maintenanceMargin = amt * markPrice * baseMmrRatio;
              const marginBalance = Math.max(0.01, marginUsdt + unrealizedPnl);
              const mmrPercentage = (maintenanceMargin / marginBalance) * 100;
              const isProfit = unrealizedPnl >= 0;

              return (
                <div className="bg-slate-900/60 border border-cyan-500/20 rounded-2xl p-5 mb-6 shadow-xl">
                  {/* Live Monitor Header */}
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-xs font-extrabold text-white uppercase tracking-wider">Live Position Monitor</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono">
                      <span className="text-slate-400">Mark: <span className="text-white font-bold">${markPrice.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</span></span>
                      <span className="text-slate-400">Entry: <span className="text-slate-200">${ep.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}</span></span>
                    </div>
                  </div>

                  {/* PnL + ROE row */}
                  <div className="grid grid-cols-2 border-b border-slate-800/60 pb-4 mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">Unrealized PnL (USDT)</span>
                      <div className={`text-2xl font-extrabold font-mono tracking-tight flex items-baseline ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {isProfit ? '+' : ''}{unrealizedPnl.toFixed(4)}
                        <span className="text-[11px] font-medium text-slate-500 ml-1.5 font-sans">
                          ≈ ₹{(unrealizedPnl * 87.5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[10px] text-slate-400 font-medium">ROE</span>
                      <div className={`text-2xl font-extrabold font-mono tracking-tight ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {isProfit ? '+' : ''}{roe.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Size / Margin / MMR */}
                  <div className="grid grid-cols-3 bg-slate-950/40 p-3 border border-slate-800/60 rounded-xl mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 font-medium uppercase">Size ({baseSymbol})</span>
                      <span className="text-xs font-bold text-slate-200 font-mono">{amt.toFixed(4)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 font-medium uppercase">Margin (USDT)</span>
                      <span className="text-xs font-bold text-slate-200 font-mono">{marginUsdt.toFixed(4)}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[9px] text-slate-500 font-medium uppercase">MMR</span>
                      <span className="text-xs font-bold text-slate-200 font-mono text-right">{mmrPercentage.toFixed(2)}%</span>
                    </div>
                  </div>

                  {/* Entry / Mark / Est Liq */}
                  <div className="grid grid-cols-3 text-xs text-slate-400 font-mono mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">Entry price</span>
                      <span className="font-bold text-slate-300">{ep.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">Mark price</span>
                      <span className={`font-bold ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{markPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[9px] text-slate-500 uppercase text-right">Est. liq. price</span>
                      <span className="font-extrabold text-[#f0b90b] text-right">{estLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                  </div>

                  {/* TP / SL / Trailing Peak */}
                  <div className="grid grid-cols-3 text-xs font-mono border-t border-slate-800/60 pt-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">TP Price (8%)</span>
                      <span className="font-bold text-[#0ecb81]">{tpPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-slate-500 uppercase">SL Price (2% Trail)</span>
                      <span className="font-bold text-[#f6465d]">{slPrice.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className="text-[9px] text-slate-500 uppercase text-right">Trailing Peak</span>
                      <span className="font-bold text-slate-300 text-right">{estimatedPeak.toLocaleString(undefined, { minimumFractionDigits: 4 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ─── Groq Cloud AI Focus Brain View ─── */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5 border-b border-slate-800 pb-4">
                <Bot className="h-5 w-5 text-cyan-400" />
                <div>
                  <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">Groq Cloud AI Quantitative Brain</h2>
                  {linkedCandidate
                    ? <p className="text-[10px] text-slate-400 font-mono mt-0.5">Linked scan for {selectedTrade.symbol} · logged {new Date(linkedCandidate.created_at).toLocaleString()}</p>
                    : <p className="text-[10px] text-amber-400 font-mono mt-0.5">⚠ No pipeline scan found for this trade in current session data</p>
                  }
                </div>
              </div>

              {linkedCandidate ? (
                <div className="flex flex-col gap-4">
                  {/* Technical Indicators */}
                  {linkedCandidate.indicators && Object.keys(linkedCandidate.indicators).length > 0 && (
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                      <span className="font-bold text-white text-xs uppercase tracking-wider mb-2 block">Technical Indicators</span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(linkedCandidate.indicators).map(([key, value]) => {
                          const valNum = typeof value === 'number' ? value : parseFloat(value as any);
                          return (
                            <div key={key} className="bg-slate-900 border border-slate-850 px-2 py-1 rounded flex gap-2 items-center">
                              <span className="text-[9px] text-slate-500 uppercase">{key.replace('tech_', '')}</span>
                              <span className="text-[10px] font-bold font-mono text-cyan-400">{isNaN(valNum) ? String(value) : valNum.toFixed(4)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* LLM Reasoning */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 flex gap-4 items-start">
                    <div className="h-8 w-8 bg-indigo-950 border border-indigo-500/30 rounded-lg flex items-center justify-center text-xs text-indigo-400 font-bold font-mono shrink-0">AI</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-white text-xs uppercase tracking-wider">AI Reasoning Log</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          linkedCandidate.action === 'TRADE' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20' :
                          linkedCandidate.action === 'WATCH' ? 'bg-cyan-950/50 text-cyan-400 border-cyan-500/20' :
                          linkedCandidate.action === 'VETO' ? 'bg-rose-950/50 text-rose-400 border-rose-500/20' :
                          'bg-amber-950/50 text-amber-400 border-amber-500/20'
                        }`}>
                          {linkedCandidate.action || 'EVALUATED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap font-mono">
                        {linkedCandidate.message || 'No detailed message provided.'}
                      </p>
                      {linkedCandidate.llm_source && (
                        <div className="mt-4 p-3 bg-slate-900/80 rounded border border-slate-800 font-mono text-[9px] text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {linkedCandidate.llm_source}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500">
                  <Bot className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">No agent analysis scan found for this trade.</p>
                  <p className="text-[10px] mt-2 text-slate-600">This may be a historical trade before the cloud AI engine was active, or the scan data has expired from the live session cache.</p>
                </div>
              )}
            </div>

            {/* Back button at bottom */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setSelectedTrade(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800 hover:border-slate-600 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Ledger
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==================== PREMIUM INTERACTIVE MODALS FOR KPI CARDS ==================== */}
      
      {/* KPI Modal 1: Virtual Cash compounding details */}
      {kpiModal === 'balance' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl">
            <button onClick={() => setKpiModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="h-6 w-6 text-cyan-400" />
              <h3 className="text-lg font-bold text-white">Virtual Wallet Compound Details</h3>
            </div>
            
            <div className="flex flex-col gap-4 text-slate-300 text-xs leading-relaxed">
              <p>
                To replicate trading in a safe environment, our system simulates a virtual capital portfolio. This allows checking AI logic and compiling compounding returns without real capital risk.
              </p>
              
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl font-mono flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Initial Base Capital:</span>
                  <span className="text-white font-bold">$10.00 USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Capital:</span>
                  <span className="text-cyan-400 font-bold">${walletBalance.toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 mt-1">
                  <span className="text-slate-500">Compounds Active:</span>
                  <span className="text-emerald-400 font-bold">10% Dynamic Margin Sizing</span>
                </div>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3 py-1 font-mono text-[10px] text-emerald-400 bg-emerald-950/10">
                🚀 Every trade size is dynamically adjusted to 10% of your current balance, guaranteeing maximum compound growth on winning runs while reducing size on losing runs!
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setKpiModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Modal 2: Margin and Leverage details */}
      {kpiModal === 'margin' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl">
            <button onClick={() => setKpiModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Coins className="h-6 w-6 text-indigo-400" />
              <h3 className="text-lg font-bold text-white">Dynamic Margin & Leverage</h3>
            </div>
            
            <div className="flex flex-col gap-4 text-slate-300 text-xs leading-relaxed">
              <p>
                Our 7-Agent automated quantitative pipeline enforces rigid trade allocation boundaries to protect our virtual capital.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Dynamic Risk Margin</div>
                  <div className="text-sm font-black text-white mt-1">10% / Trade</div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug">Uses exactly 10% of current wallet balance as margin.</p>
                </div>
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl">
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Futures Leverage</div>
                  <div className="text-sm font-black text-white mt-1">5x Leverage</div>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug">Amplifies buying power for contract quantity calculations.</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl font-mono flex flex-col gap-2">
                <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Contract Quantity Math:</div>
                <div className="flex justify-between">
                  <span>Simulated Margin:</span>
                  <span className="text-white">${(walletBalance * 0.1).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Buying Power (5x):</span>
                  <span className="text-white">${(walletBalance * 0.1 * 5).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 mt-1">
                  <span>Contracts:</span>
                  <span className="text-indigo-400 font-bold">Buying Power / Market Price</span>
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setKpiModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Modal 3: Realized PnL details */}
      {kpiModal === 'pnl' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl">
            <button onClick={() => setKpiModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">Net realized PnL Analytics</h3>
            </div>
            
            <div className="flex flex-col gap-4 text-slate-300 text-xs leading-relaxed font-mono">
              <p className="font-sans text-xs">
                Real-time tracking of compounding profits and closed trade results in virtual USDT.
              </p>
              
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Closed Realized PnL:</span>
                  <span className={totalPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    ${totalPnL.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Average Profit / Trade:</span>
                  <span className={avgPnL >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    ${avgPnL.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Closed Trades:</span>
                  <span className="text-white font-bold">{totalClosed}</span>
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setKpiModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Modal 4: Win Rate details */}
      {kpiModal === 'winrate' && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full relative shadow-2xl">
            <button onClick={() => setKpiModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <Percent className="h-6 w-6 text-amber-400" />
              <h3 className="text-lg font-bold text-white">Alpha Win Rate metrics</h3>
            </div>
            
            <div className="flex flex-col gap-4 text-slate-300 text-xs leading-relaxed font-mono">
              <p className="font-sans text-xs">
                Real-time tracking of correct directional entries.
              </p>
              
              <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Pipeline Runs:</span>
                  <span className="text-white font-bold">{focusLogs.length} Scans</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Executed Trade Count:</span>
                  <span className="text-white font-bold">{trades.length}</span>
                </div>
                <div className="flex justify-between border-t border-slate-850 pt-2 mt-1">
                  <span className="text-slate-500">Forensic Alpha Win Rate:</span>
                  <span className="text-amber-400 font-bold">{(telemetry.winRate * 100).toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setKpiModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Close details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
