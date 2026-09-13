"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setServerFocusedCoin = setServerFocusedCoin;
exports.startHttpServer = startHttpServer;
/**
 * server.ts
 * Lightweight HTTP server for Render deployment:
 *  1. /health endpoint for 24/7 uptime pinging & telemetry
 *  2. Static file server for the built web dashboard (dashboard/dist)
 */
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const groq_client_1 = require("./groq-client");
const supabase_logger_1 = require("./supabase-logger");
const risk_governor_1 = require("./risk-governor");
let currentFocusedCoin = 'None';
let engineCycleCount = 0;
const startTime = Date.now();
function setServerFocusedCoin(coin, cycle) {
    currentFocusedCoin = coin;
    engineCycleCount = cycle;
}
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};
function startHttpServer(port = config_1.CONFIG.PORT) {
    const dashboardDistPath = path_1.default.resolve(__dirname, '..', 'dashboard', 'dist');
    const server = http_1.default.createServer(async (req, res) => {
        // Enable CORS for external dashboard consumption
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        const urlPath = (req.url || '/').split('?')[0];
        // ─── Health / Ping Endpoint ────────────────────────────────────────────────
        if (urlPath === '/health' || urlPath === '/api/health') {
            try {
                const wallet = await (0, supabase_logger_1.fetchWalletBalance)().catch(() => 0);
                const openTrades = await (0, supabase_logger_1.fetchOpenFuturesTrades)().catch(() => []);
                const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
                const health = {
                    status: 'HEALTHY',
                    service: 'focus-trading-engine',
                    version: config_1.CONFIG.VERSION,
                    mode: config_1.CONFIG.DRY_RUN ? 'DRY_RUN (Simulation v3.0)' : 'LIVE (v3.0)',
                    uptime_seconds: uptimeSeconds,
                    cycle_count: engineCycleCount,
                    focused_coin: currentFocusedCoin,
                    wallet_balance: wallet,
                    wallet_balance_inr: Math.round(wallet * 88.5 * 100) / 100,
                    inr_rate: 88.50,
                    active_positions_count: openTrades.length,
                    active_positions: openTrades.map(t => ({
                        symbol: t.symbol,
                        side: t.position_side,
                        entry: t.entry_price,
                        size: t.amount,
                    })),
                    risk_governor: risk_governor_1.riskGovernor.getStatus(),
                    groq_cloud_llm: (0, groq_client_1.getGroqUsageSummary)(),
                    timestamp: new Date().toISOString(),
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(health, null, 2));
                return;
            }
            catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
                return;
            }
        }
        // ─── Dashboard Static File Serving ─────────────────────────────────────────
        if (fs_1.default.existsSync(dashboardDistPath)) {
            let filePath = path_1.default.join(dashboardDistPath, urlPath === '/' ? 'index.html' : urlPath);
            // If requested file doesn't exist, fallback to index.html (SPA history mode)
            if (!fs_1.default.existsSync(filePath) || fs_1.default.statSync(filePath).isDirectory()) {
                filePath = path_1.default.join(dashboardDistPath, 'index.html');
            }
            const ext = path_1.default.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            try {
                const content = fs_1.default.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
                return;
            }
            catch {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
        }
        // Fallback if dashboard dist is not built yet
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
      <html>
        <head><title>Focus Trading Engine</title></head>
        <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem;">
          <h1>⚡ Focus Trading Engine Active</h1>
          <p>Engine status: <strong>RUNNING</strong> (${config_1.CONFIG.DRY_RUN ? 'Simulation Mode' : 'Live'})</p>
          <p>Uptime: ${Math.floor((Date.now() - startTime) / 1000)}s | Focused Coin: <strong>${currentFocusedCoin}</strong></p>
          <p>Check <a href="/health" style="color: #38bdf8;">/health</a> for JSON telemetry.</p>
        </body>
      </html>
    `);
    });
    server.listen(port, () => {
        console.log(`[HTTP Server] 🌐 Server running on port ${port} (Health: /health)`);
    });
    return server;
}
//# sourceMappingURL=server.js.map