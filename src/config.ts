import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export const CONFIG = {
  VERSION:                   '3.1.0',
  PORT:                      parseInt(optional('PORT', '3000')),
  SUPABASE_URL:              required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  BITGET_API_KEY:            required('BITGET_API_KEY'),
  BITGET_SECRET_KEY:         required('BITGET_SECRET_KEY'),
  BITGET_PASSPHRASE:         required('BITGET_PASSPHRASE'),
  
  // Primary LLM: Google Gemini 3.6 Flash (6-key rotation)
  GEMINI_MODEL:              optional('GEMINI_MODEL', 'gemini-3.6-flash'),
  GEMINI_KEYS: [
    process.env.gemini_api_key,  process.env.gemini_api_key2,
    process.env.gemini_api_key3, process.env.gemini_api_key4,
    process.env.gemini_api_key5, process.env.gemini_api_key6,
  ].filter(Boolean) as string[],

  // Secondary Failover LLM: Groq Cloud (5-key rotation)
  GROQ_MODEL:                optional('GROQ_MODEL', 'openai/gpt-oss-20b'),
  GROQ_KEYS: [
    process.env.GROQ_API_KEY,  process.env.GROQ_API_KEY2,
    process.env.GROQ_API_KEY3, process.env.GROQ_API_KEY4,
    process.env.GROQ_API_KEY5, process.env.GROQ_API_KEY6,
    process.env.GROQ_API_KEY7,
  ].filter(Boolean) as string[],

  WATCH_DURATION_MS:   parseInt(optional('WATCH_DURATION_MINUTES', '3')) * 60 * 1000, // 3-min fast rotation for high opportunity rate
  MAX_CANDIDATES_POOL: 6, // Top 6 liquid candidates evaluated
  DRY_RUN:             optional('DRY_RUN', 'true') !== 'false',
  MIN_VOLUME_USDT:     parseFloat(optional('MIN_VOLUME_USDT', '5000000')), // $5M minimum liquidity floor
  CLOUD_API_URL:       optional('CLOUD_API_URL', 'http://localhost:3001'),
  CLOUD_API_KEY:       optional('CLOUD_API_KEY', ''),
} as const;

export const RISK = {
  LEVERAGE: 3,                 // v3: Reduced from 5x to 3x to give room for 1.8x ATR stops
  RISK_FACTOR: 0.05,           // 5% margin allocation per trade
  MARGIN_PER_TRADE: 1.00,      // Flat $1.00 margin per trade ($3.00 notional at 3x)
  
  // Dynamic ATR Geometry (Triple Barrier)
  STOP_LOSS_ATR_MULT: 1.8,     // Structural dynamic stop = 1.8 * ATR
  TAKE_PROFIT_ATR_MULT: 3.2,   // Target reward = 3.2 * ATR (Planned R:R = 1.78:1)
  BREAKEVEN_ATR_TRIGGER: 1.2,  // Move stop to breakeven + roundtrip fees at +1.2 * ATR profit
  TRAILING_STOP_ATR_MULT: 1.8, // Trailing stop distance behind peak
  
  // Fee Structure
  FEE_RATE_TAKER: 0.0006,      // Bitget taker: 0.06%
  FEE_RATE_MAKER: 0.0002,      // Bitget maker: 0.02%
  FEE_RATE: 0.0006,            // Default fallback
  
  // Liquidity & Spread Protection
  MAX_SPREAD_PCT: 0.0015,      // Reject coins with > 0.15% bid-ask spread
  MAX_FUNDING_ABS: 0.0003,     // Alert if 8h funding rate > |0.03%| (crowded squeeze risk)
  
  // Time and Circuit Breaker Stops
  MIN_HOLD_MINUTES: 5,
  MAX_HOLD_HOURS: 8,           // v3: Aligned with 15m/5m timeframe
  STALE_HOLD_HOURS: 2.5,       // Flat exit if no progress after 2.5h
  STALE_PROFIT_THRESHOLD: 0.01,// 1% profit threshold
  
  // Risk Governor Safeguards
  CONSECUTIVE_LOSS_LIMIT: 2,   // 2 stop-outs on a symbol triggers cooldown
  SYMBOL_COOLDOWN_MS: 4 * 60 * 60 * 1000, // 4-hour cooldown for stopped-out coins
  DAILY_MAX_DRAWDOWN_PCT: 0.05,// 5% account drawdown activates daily kill-switch
} as const;

export const SIGNAL = {
  PRIMARY_TIMEFRAME: '15m',    // 15m trend & market structure
  TRIGGER_TIMEFRAME: '5m',     // 5m pullback & rejection trigger
  
  RSI_PULLBACK_LONG: 48,       // 5m RSI dip zone for pullback long
  RSI_PULLBACK_SHORT: 52,      // 5m RSI bounce zone for pullback short
  RSI_OVERBOUGHT: 68,          // Overbought threshold (veto long entries)
  RSI_OVERSOLD: 32,            // Oversold threshold (veto short entries)
  
  ADX_MIN: 20,                 // Minimum directional trend strength
  CHOP_MAX: 58,                // Block choppy consolidation
  VOLUME_ZSCORE_MIN: 0.8,      // Require volume confirmation (z-score >= 0.8)
  SIGNAL_COOLDOWN_MS: 3 * 60 * 1000, // 3-min cooldown between signals on the same symbol
} as const;
