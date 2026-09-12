/**
 * server.ts
 * Lightweight HTTP server for Render deployment:
 *  1. /health endpoint for 24/7 uptime pinging & telemetry
 *  2. Static file server for the built web dashboard (dashboard/dist)
 */
import http from 'http';
export declare function setServerFocusedCoin(coin: string, cycle: number): void;
export declare function startHttpServer(port?: number): http.Server;
//# sourceMappingURL=server.d.ts.map