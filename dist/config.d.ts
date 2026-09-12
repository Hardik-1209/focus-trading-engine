export declare const CONFIG: {
    readonly PORT: number;
    readonly SUPABASE_URL: string;
    readonly SUPABASE_SERVICE_ROLE_KEY: string;
    readonly BITGET_API_KEY: string;
    readonly BITGET_SECRET_KEY: string;
    readonly BITGET_PASSPHRASE: string;
    readonly GROQ_MODEL: string;
    readonly GROQ_KEYS: string[];
    readonly WATCH_DURATION_MS: number;
    readonly DRY_RUN: boolean;
    readonly MIN_VOLUME_USDT: number;
    readonly CLOUD_API_URL: string;
    readonly CLOUD_API_KEY: string;
};
export declare const RISK: {
    readonly LEVERAGE: 5;
    readonly RISK_FACTOR: 0.1;
    readonly TAKE_PROFIT_PCT: 0.06;
    readonly TRAILING_STOP_PCT: 0.025;
    readonly MAX_LOSS_PCT: 0.04;
    readonly STOP_LOSS_ACTUAL_PCT: 0.03;
    readonly FEE_RATE: 0.0006;
    readonly MIN_HOLD_MINUTES: 5;
    readonly MAX_HOLD_HOURS: 6;
    readonly STALE_HOLD_HOURS: 1.5;
    readonly STALE_PROFIT_THRESHOLD: 0.015;
    readonly USE_ATR_STOP: true;
    readonly ATR_MULTIPLIER: 2;
};
export declare const SIGNAL: {
    readonly RSI_PULLBACK_LONG: 42;
    readonly RSI_PULLBACK_SHORT: 58;
    readonly RSI_TREND_LONG: 52;
    readonly RSI_TREND_SHORT: 48;
    readonly ADX_STRONG: 25;
    readonly ADX_WEAK: 20;
    readonly VOLUME_ZSCORE_MIN: 1.2;
    readonly SIGNAL_COOLDOWN_MS: number;
    readonly USE_5M_FILTER: true;
};
//# sourceMappingURL=config.d.ts.map