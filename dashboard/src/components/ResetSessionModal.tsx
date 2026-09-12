import React, { useState } from 'react';
import type { FuturesTrade } from '../store/useGlobalStore';
import { formatUSD, formatINR } from '../utils/formatters';
import { resetTradingSession } from '../utils/sessionManager';
import {
  RotateCcw,
  X,
  AlertTriangle,
  Archive,
  Loader2,
} from 'lucide-react';

interface ResetSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrades: FuturesTrade[];
  currentWalletBalance: number;
  inrRate: number;
  onResetSuccess: (newSessionId: string) => void;
}

export const ResetSessionModal: React.FC<ResetSessionModalProps> = ({
  isOpen,
  onClose,
  currentTrades,
  currentWalletBalance,
  inrRate,
  onResetSuccess,
}) => {
  if (!isOpen) return null;

  const defaultName = `Snapshot — ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  const [snapshotName, setSnapshotName] = useState(defaultName);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active unarchived closed trades
  const activeClosedTrades = currentTrades.filter((t) => !t.is_archived && t.status === 'CLOSED');
  let activePnl = 0;
  let wins = 0;
  for (const t of activeClosedTrades) {
    const p = typeof t.realized_pnl === 'number' ? t.realized_pnl : parseFloat((t.realized_pnl as any) || '0');
    activePnl += p;
    if (p > 0) wins++;
  }
  const winRate = activeClosedTrades.length > 0 ? ((wins / activeClosedTrades.length) * 100).toFixed(1) : '0.0';

  const handleConfirmReset = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    const result = await resetTradingSession({
      sessionName: snapshotName.trim() || defaultName,
      currentTrades,
      currentWalletBalance,
      inrRate,
    });

    setIsLoading(false);

    if (result.success) {
      onResetSuccess(result.newSessionId);
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to archive and reset session.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Reset Trading Session & Archive Snapshot</h3>
            <p className="text-xs text-slate-400">Soft-delete live session and reset baseline capital to $10.00</p>
          </div>
        </div>

        {/* Current Session Summary Card */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5 text-cyan-400" />
            <span>Active Session Stats to be Archived</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold block">TOTAL TRADES</span>
              <span className="text-base font-black text-white">{activeClosedTrades.length}</span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold block">NET P&L</span>
              <span className={`text-base font-black ${activePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {activePnl >= 0 ? '+' : ''}{formatUSD(activePnl)}
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                {activePnl >= 0 ? '+' : ''}{formatINR(activePnl, inrRate)}
              </span>
            </div>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 font-bold block">WIN RATE</span>
              <span className="text-base font-black text-cyan-400">{winRate}%</span>
            </div>
          </div>
        </div>

        {/* Snapshot Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">Snapshot Name / Label</label>
          <input
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="e.g. Morning Scalp Run #1"
            className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none"
          />
          <p className="text-[11px] text-slate-500">
            This snapshot will be saved in your database history so you can switch back and review its equity curve anytime.
          </p>
        </div>

        {/* Warning Alert */}
        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Zero Data Loss Guarantee:</span>
            <span className="text-[11px] text-amber-300/80 leading-relaxed block">
              All trade logs and Groq evaluations remain stored in Supabase. Only the active view resets to 0 trades, $10.00 virtual capital, and Cycle #1.
            </span>
          </div>
        </div>

        {/* Error Message if any */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmReset}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition-all shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Archiving Snapshot...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Confirm & Reset Baseline</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
