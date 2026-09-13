import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/trades_dump.json', 'utf8'));
const trades = data.trades;
const tiers: Record<string, { count: number; wins: number; pnl: number }> = {};
const llmSources: Record<string, { count: number; wins: number; pnl: number }> = {};
let totalDurationMs = 0;
let minDurationMs = Infinity;
let maxDurationMs = 0;

trades.forEach((t: any) => {
  const tierKey = String(t.tier || 'unknown');
  const llmKey = String(t.llm_source || 'none');
  const pnl = parseFloat(t.realized_pnl) || 0;
  const isWin = pnl > 0;

  if (!tiers[tierKey]) tiers[tierKey] = { count: 0, wins: 0, pnl: 0 };
  tiers[tierKey].count++;
  if (isWin) tiers[tierKey].wins++;
  tiers[tierKey].pnl += pnl;

  if (!llmSources[llmKey]) llmSources[llmKey] = { count: 0, wins: 0, pnl: 0 };
  llmSources[llmKey].count++;
  if (isWin) llmSources[llmKey].wins++;
  llmSources[llmKey].pnl += pnl;

  if (t.closed_at && t.created_at) {
    const dur = new Date(t.closed_at).getTime() - new Date(t.created_at).getTime();
    totalDurationMs += dur;
    if (dur < minDurationMs) minDurationMs = dur;
    if (dur > maxDurationMs) maxDurationMs = dur;
  }
});

console.log('Tiers Breakdown:', JSON.stringify(tiers, null, 2));
console.log('LLM Sources Breakdown:', JSON.stringify(llmSources, null, 2));
console.log('Avg duration (minutes):', (totalDurationMs / trades.length / 60000).toFixed(1));
console.log('Min duration (seconds):', Math.round(minDurationMs / 1000));
console.log('Max duration (minutes):', (maxDurationMs / 60000).toFixed(1));
