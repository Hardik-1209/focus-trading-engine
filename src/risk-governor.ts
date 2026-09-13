/**
 * risk-governor.ts
 * Centralized Risk Governance Engine (v3.0)
 *
 * Implements research-backed capital protection mechanisms:
 * 1. Consecutive-loss symbol circuit breakers (2 losses -> 4h freeze)
 * 2. Daily portfolio max-drawdown kill switch (5% daily loss -> halt trading)
 * 3. Rolling trade expectancy and fee-drag tracking
 * 4. Adversarial LLM approval rate monitoring (target: 20% - 35%)
 */
import { RISK } from './config';

export interface SymbolStreak {
  consecutiveLosses: number;
  lastTradeTime: number;
  cooldownUntil: number;
  totalTrades: number;
  netPnl: number;
}

export interface RiskGovernorStatus {
  dailyHalted: boolean;
  dailyStartingBalance: number;
  dailyRealizedPnl: number;
  dailyDrawdownPct: number;
  activeCooldowns: Array<{ symbol: string; cooldownRemainingMin: number; consecutiveLosses: number }>;
  rollingExpectancy: number;
  rollingWinRate: number;
  llmTotalEvaluations: number;
  llmApprovals: number;
  llmApprovalRate: number;
  version: string;
}

class RiskGovernor {
  private symbolStreaks: Map<string, SymbolStreak> = new Map();
  private dailyStartingBalance = 10.00;
  private dailyRealizedPnl = 0;
  private dailyHalted = false;
  private dailyResetDate = new Date().getUTCDate();

  // Rolling statistics (last 20 trades)
  private recentTrades: Array<{ pnl: number; isWin: boolean }> = [];

  // LLM approval tracking
  private llmTotal = 0;
  private llmApproved = 0;

  constructor() {
    this.checkDayRoll();
  }

  private checkDayRoll() {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.dailyResetDate) {
      console.log('[Risk Governor] 🌅 New UTC day detected. Resetting daily drawdown counters.');
      this.dailyResetDate = currentDay;
      this.dailyRealizedPnl = 0;
      this.dailyHalted = false;
    }
  }

  public setStartingBalance(balance: number) {
    if (balance > 0) {
      this.dailyStartingBalance = balance;
    }
  }

  /**
   * Evaluates whether an asset is permissible to trade.
   * Checks daily portfolio kill switch and symbol-level circuit breakers.
   */
  public canTradeSymbol(symbol: string): { allowed: boolean; reason?: string } {
    this.checkDayRoll();

    // 1. Global Daily Max Drawdown Check
    if (this.dailyHalted) {
      return {
        allowed: false,
        reason: `DAILY_KILL_SWITCH_ACTIVE: Account reached ${(RISK.DAILY_MAX_DRAWDOWN_PCT * 100).toFixed(1)}% daily max loss. Trading halted until next UTC day.`,
      };
    }

    const drawdownPct = Math.abs(Math.min(0, this.dailyRealizedPnl)) / Math.max(1, this.dailyStartingBalance);
    if (drawdownPct >= RISK.DAILY_MAX_DRAWDOWN_PCT) {
      this.dailyHalted = true;
      console.warn(`[Risk Governor] 🚨 DAILY KILL SWITCH TRIGGERED: Daily loss -$${Math.abs(this.dailyRealizedPnl).toFixed(4)} exceeded ${(RISK.DAILY_MAX_DRAWDOWN_PCT * 100).toFixed(1)}% of wallet. Halting all new trades.`);
      return {
        allowed: false,
        reason: `DAILY_KILL_SWITCH_TRIGGERED: Daily loss reached ${(drawdownPct * 100).toFixed(1)}%.`,
      };
    }

    // 2. Symbol Consecutive Loss Cooldown Check
    const streak = this.symbolStreaks.get(symbol);
    if (streak && streak.cooldownUntil > Date.now()) {
      const remainingMin = Math.ceil((streak.cooldownUntil - Date.now()) / 60000);
      return {
        allowed: false,
        reason: `SYMBOL_CIRCUIT_BREAKER: ${symbol} has ${streak.consecutiveLosses} consecutive stop-outs. Frozen for another ${remainingMin} minutes.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Called on every position closure to update streaks and drawdown.
   */
  public recordTradeOutcome(symbol: string, pnl: number, isWin: boolean) {
    this.checkDayRoll();

    this.dailyRealizedPnl += pnl;

    // Update symbol streak
    let streak = this.symbolStreaks.get(symbol);
    if (!streak) {
      streak = {
        consecutiveLosses: 0,
        lastTradeTime: Date.now(),
        cooldownUntil: 0,
        totalTrades: 0,
        netPnl: 0,
      };
      this.symbolStreaks.set(symbol, streak);
    }

    streak.lastTradeTime = Date.now();
    streak.totalTrades += 1;
    streak.netPnl += pnl;

    if (isWin) {
      streak.consecutiveLosses = 0;
      console.log(`[Risk Governor] ✅ ${symbol} WIN recorded (+$${pnl.toFixed(4)}). Consecutive loss counter reset.`);
    } else {
      streak.consecutiveLosses += 1;
      console.warn(`[Risk Governor] ⚠️ ${symbol} LOSS recorded (-$${Math.abs(pnl).toFixed(4)}). Streak: ${streak.consecutiveLosses}/${RISK.CONSECUTIVE_LOSS_LIMIT}`);

      if (streak.consecutiveLosses >= RISK.CONSECUTIVE_LOSS_LIMIT) {
        streak.cooldownUntil = Date.now() + RISK.SYMBOL_COOLDOWN_MS;
        const cooldownHours = (RISK.SYMBOL_COOLDOWN_MS / 3600000).toFixed(1);
        console.error(`[Risk Governor] 🛑 CIRCUIT BREAKER TRIGGERED for ${symbol}: ${streak.consecutiveLosses} consecutive losses! Symbol frozen for ${cooldownHours} hours.`);
      }
    }

    // Update rolling buffer
    this.recentTrades.push({ pnl, isWin });
    if (this.recentTrades.length > 20) {
      this.recentTrades.shift();
    }
  }

  /**
   * Records LLM evaluation results to monitor approval rate.
   */
  public recordLlmDecision(approved: boolean) {
    this.llmTotal += 1;
    if (approved) this.llmApproved += 1;
    const rate = ((this.llmApproved / this.llmTotal) * 100).toFixed(1);
    console.log(`[Risk Governor] LLM Gate Telemetry: ${this.llmApproved}/${this.llmTotal} approved (${rate}%) [Target: 20-35%]`);
  }

  public getStatus(): RiskGovernorStatus {
    this.checkDayRoll();

    const now = Date.now();
    const activeCooldowns: Array<{ symbol: string; cooldownRemainingMin: number; consecutiveLosses: number }> = [];

    for (const [sym, streak] of this.symbolStreaks.entries()) {
      if (streak.cooldownUntil > now) {
        activeCooldowns.push({
          symbol: sym,
          cooldownRemainingMin: Math.ceil((streak.cooldownUntil - now) / 60000),
          consecutiveLosses: streak.consecutiveLosses,
        });
      }
    }

    // Calculate rolling expectancy
    let rollingWins = 0;
    let totalWinPnl = 0;
    let totalLossPnl = 0;

    for (const t of this.recentTrades) {
      if (t.isWin) {
        rollingWins++;
        totalWinPnl += t.pnl;
      } else {
        totalLossPnl += t.pnl;
      }
    }

    const n = this.recentTrades.length;
    const winRate = n > 0 ? (rollingWins / n) * 100 : 0;
    const avgWin = rollingWins > 0 ? totalWinPnl / rollingWins : 0;
    const lossCount = n - rollingWins;
    const avgLoss = lossCount > 0 ? totalLossPnl / lossCount : 0;
    const expectancy = n > 0 ? ((winRate / 100) * avgWin + ((100 - winRate) / 100) * avgLoss) : 0;

    const approvalRate = this.llmTotal > 0 ? (this.llmApproved / this.llmTotal) * 100 : 0;
    const drawdownPct = (Math.abs(Math.min(0, this.dailyRealizedPnl)) / Math.max(1, this.dailyStartingBalance)) * 100;

    return {
      dailyHalted: this.dailyHalted,
      dailyStartingBalance: this.dailyStartingBalance,
      dailyRealizedPnl: parseFloat(this.dailyRealizedPnl.toFixed(4)),
      dailyDrawdownPct: parseFloat(drawdownPct.toFixed(2)),
      activeCooldowns,
      rollingExpectancy: parseFloat(expectancy.toFixed(4)),
      rollingWinRate: parseFloat(winRate.toFixed(1)),
      llmTotalEvaluations: this.llmTotal,
      llmApprovals: this.llmApproved,
      llmApprovalRate: parseFloat(approvalRate.toFixed(1)),
      version: '3.0.0',
    };
  }
}

export const riskGovernor = new RiskGovernor();
