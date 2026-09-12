# ⚡ Cloud Focus Trading Engine v2.0

> 24/7 Autonomous Crypto Futures Trading Engine powered by Groq Cloud LLM Multi-Key Array, Bitget WebSocket Streaming, and Real-Time Telemetry Dashboard.

---

## 🚀 Key Features

* **High-Accuracy Quantitative Signal Engine**:
  * **1m + 5m Multi-Timeframe Confirmation**: 5m macro trend alignment (EMA 9/21/50 + RSI regime) filters out chop and whipsaw false breakouts.
  * **Dynamic ATR Volatility Stops**: Adapts stop-loss and trailing stops based on real Average True Range instead of static percentages.
  * **Volume Z-Score Confirmation**: Requires surge in volume flow before taking entries.

* **Groq Cloud LLM Multi-Key Rotation**:
  * Powered by `openai/gpt-oss-20b` (or `qwen/qwen3.8-27b`) with sub-second response times.
  * Automated round-robin rotation across 5 Groq API keys with instant 429 rate-limit failover.
  * Zero-failure JSON schemas for quantitative narrative and risk evaluations.

* **Integrated 24/7 Cloud Architecture**:
  * Built-in HTTP server with `/health` endpoint for uptime pinging.
  * Built-in static SPA server hosting the modern React + Vite + Tailwind trading dashboard on the same URL.
  * Ready for 1-click deployment on Render.

---

## 📦 Project Structure

```
├── dashboard/              # React + Vite + Tailwind + Recharts Dashboard
├── src/
│   ├── bitget-ws.ts        # Persistent WebSocket stream for ticker & candles
│   ├── coin-selector.ts    # Scans and selects highest-volatility futures coin
│   ├── config.ts           # Central quantitative & environment configuration
│   ├── focus-engine.ts     # 30-min rotation and trade execution orchestrator
│   ├── groq-client.ts      # Cloud LLM engine with 5-key rotation & failover
│   ├── indicators.ts       # EMA, RSI, MACD, ADX, ATR, Volume Z-Score, MTF Trend
│   ├── llm-router.ts       # Cloud LLM routing with rule-based fallback
│   ├── main.ts             # Application entrypoint
│   ├── position-guardian.ts# Real-time tick guardian with ATR trailing stops
│   ├── server.ts           # Lightweight HTTP server for /health & Dashboard
│   └── supabase-logger.ts  # Database logger for trades, health & telemetry
├── render.yaml             # Render cloud deployment blueprint
├── package.json
└── tsconfig.json
```

---

## 🛠 Local Development

```bash
# 1. Install dependencies
npm install
cd dashboard && npm install && cd ..

# 2. Start trading engine & dashboard
npm run dev

# 3. Build for production
npm run build
npm start
```
