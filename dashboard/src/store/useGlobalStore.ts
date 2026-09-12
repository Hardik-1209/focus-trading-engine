import { create } from 'zustand';

export interface FuturesTrade {
  id: string;
  created_at?: string;
  symbol: string;
  position_side: 'LONG' | 'SHORT';
  amount: number;
  entry_price: number | string;
  exit_price?: number | string;
  realized_pnl?: number | string;
  status: 'OPEN' | 'CLOSED' | 'FAILED';
  pipeline_candidate_id?: string;
  closed_at?: string;
  tier?: number;
  llm_source?: string;
  take_profit_price?: number | string;
  stop_loss_price?: number | string;
  trailing_stop_pct?: number | string;
  atr?: number | string;
  exit_reason?: string;
  fee?: number | string;
  return_pct?: number | string;
}

export interface FocusLog {
  id: string;
  created_at: string;
  event_type: string;
  symbol: string;
  tier?: number;
  llm_source?: string;
  action?: string;
  indicators?: Record<string, number | boolean | string>;
  message: string;
}

export interface HealthEvent {
  id: string;
  timestamp: string;
  event_type: string;
  component: string;
  severity: string;
  message: string;
  meta_data?: any;
}

export interface EngineStatus {
  id?: string;
  last_heartbeat?: string;
  is_running?: boolean;
  focused_symbol?: string;
  cycle_count?: number;
  active_trades_count?: number;
  win_rate?: number;
  total_pnl?: number;
  active_groq_key_index?: number;
  mode?: string;
  live_indicators?: {
    price?: number;
    rsi?: number;
    adx?: number;
    chop?: number;
    vwap?: number;
    mtf?: string;
    atr?: number;
    volZ?: number;
    timestamp?: string;
  };
  updated_at?: string;
}

export interface Telemetry {
  totalTrades: number;
  winRate: number;
  realizedPnl: number;
  websocketConnected: boolean;
}

export type DashboardPage = 'overview' | 'scanner' | 'trades' | 'brain' | 'ledger' | 'health';

interface GlobalStoreState {
  focusLogs: FocusLog[];
  trades: FuturesTrade[];
  healthEvents: HealthEvent[];
  engineStatus: EngineStatus | null;
  telemetry: Telemetry;
  safeModeActive: boolean;
  activePage: DashboardPage;
  walletBalance: number;
  inrRate: number;
  livePrices: Record<string, number>;
  setFocusLogs: (logs: FocusLog[]) => void;
  addFocusLog: (log: FocusLog) => void;
  setTrades: (trades: FuturesTrade[]) => void;
  addTrade: (trade: FuturesTrade) => void;
  updateTrade: (trade: FuturesTrade) => void;
  setHealthEvents: (events: HealthEvent[]) => void;
  addHealthEvent: (event: HealthEvent) => void;
  setEngineStatus: (status: EngineStatus) => void;
  updateTelemetry: (updates: Partial<Telemetry>) => void;
  setSafeModeActive: (active: boolean) => void;
  setActivePage: (page: DashboardPage) => void;
  setWalletBalance: (balance: number) => void;
  setInrRate: (rate: number) => void;
  setLivePrice: (symbol: string, price: number) => void;
}

export const useGlobalStore = create<GlobalStoreState>((set) => ({
  focusLogs: [],
  trades: [],
  healthEvents: [],
  engineStatus: null,
  telemetry: {
    totalTrades: 0,
    winRate: 0.0,
    realizedPnl: 0.0,
    websocketConnected: false,
  },
  safeModeActive: true,
  activePage: 'overview',
  walletBalance: 10.00,
  inrRate: 88.50,
  livePrices: {},
  setFocusLogs: (focusLogs) => set({ focusLogs }),
  addFocusLog: (log) =>
    set((state) => {
      const updated = [log, ...state.focusLogs].slice(0, 100);
      return { focusLogs: updated };
    }),
  setTrades: (trades) => set({ trades }),
  addTrade: (trade) =>
    set((state) => {
      const exists = state.trades.some((t) => t.id === trade.id);
      if (exists) return state;
      return { trades: [trade, ...state.trades] };
    }),
  updateTrade: (trade) =>
    set((state) => ({
      trades: state.trades.map((t) => (t.id === trade.id ? { ...t, ...trade } : t)),
    })),
  setHealthEvents: (healthEvents) => set({ healthEvents }),
  addHealthEvent: (event) =>
    set((state) => {
      const updated = [event, ...state.healthEvents].slice(0, 100);
      return { healthEvents: updated };
    }),
  setEngineStatus: (engineStatus) => set({ engineStatus }),
  updateTelemetry: (updates) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...updates } })),
  setSafeModeActive: (safeModeActive) => set({ safeModeActive }),
  setActivePage: (activePage) => set({ activePage }),
  setWalletBalance: (walletBalance) => set({ walletBalance }),
  setInrRate: (inrRate) => set({ inrRate }),
  setLivePrice: (symbol, price) =>
    set((state) => ({
      livePrices: { ...state.livePrices, [symbol]: price },
    })),
}));
