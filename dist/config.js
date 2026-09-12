"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNAL = exports.RISK = exports.CONFIG = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function required(key) {
    const val = process.env[key];
    if (!val)
        throw new Error(`Missing required env var: ${key}`);
    return val;
}
function optional(key, fallback) {
    return process.env[key] || fallback;
}
exports.CONFIG = {
    PORT: parseInt(optional('PORT', '3000')),
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    BITGET_API_KEY: required('BITGET_API_KEY'),
    BITGET_SECRET_KEY: required('BITGET_SECRET_KEY'),
    BITGET_PASSPHRASE: required('BITGET_PASSPHRASE'),
    GROQ_MODEL: optional('GROQ_MODEL', 'openai/gpt-oss-20b'),
    GROQ_KEYS: [
        process.env.GROQ_API_KEY, process.env.GROQ_API_KEY2,
        process.env.GROQ_API_KEY3, process.env.GROQ_API_KEY4,
        process.env.GROQ_API_KEY5, process.env.GROQ_API_KEY6,
        process.env.GROQ_API_KEY7,
    ].filter(Boolean),
    WATCH_DURATION_MS: parseInt(optional('WATCH_DURATION_MINUTES', '5')) * 60 * 1000,
    DRY_RUN: optional('DRY_RUN', 'true') !== 'false',
    MIN_VOLUME_USDT: parseFloat(optional('MIN_VOLUME_USDT', '500000')),
    CLOUD_API_URL: optional('CLOUD_API_URL', 'http://localhost:3001'),
    CLOUD_API_KEY: optional('CLOUD_API_KEY', ''),
};
exports.RISK = {
    LEVERAGE: 5,
    RISK_FACTOR: 0.10,
    TAKE_PROFIT_PCT: 0.06, // 6% base target
    TRAILING_STOP_PCT: 0.025, // 2.5% trailing stop (tighter & more protective than old 5%)
    MAX_LOSS_PCT: 0.04, // 4% hard stop
    STOP_LOSS_ACTUAL_PCT: 0.03, // 3% initial stop
    FEE_RATE: 0.0006, // Bitget taker fee
    MIN_HOLD_MINUTES: 5,
    MAX_HOLD_HOURS: 6,
    STALE_HOLD_HOURS: 1.5,
    STALE_PROFIT_THRESHOLD: 0.015,
    USE_ATR_STOP: true,
    ATR_MULTIPLIER: 2.0,
};
exports.SIGNAL = {
    RSI_PULLBACK_LONG: 42,
    RSI_PULLBACK_SHORT: 58,
    RSI_TREND_LONG: 52,
    RSI_TREND_SHORT: 48,
    ADX_STRONG: 25,
    ADX_WEAK: 20,
    VOLUME_ZSCORE_MIN: 1.0,
    SIGNAL_COOLDOWN_MS: 2 * 60 * 1000, // 2 min cooldown per coin for responsive scalping
    USE_5M_FILTER: true,
};
//# sourceMappingURL=config.js.map