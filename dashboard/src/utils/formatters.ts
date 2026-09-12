export const DEFAULT_INR_RATE = 88.50;

/**
 * Format USD amount with proper decimals
 */
export function formatUSD(val?: number | string | null): string {
  if (val === undefined || val === null || val === '') return '$0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '$0.00';
  const sign = num < 0 ? '-' : '';
  const abs = Math.abs(num);
  const decimals = abs >= 1 ? 2 : abs >= 0.001 ? 4 : 6;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: decimals })}`;
}

/**
 * Format INR amount with ₹ symbol and 2 decimals
 */
export function formatINR(val?: number | string | null, rate = DEFAULT_INR_RATE): string {
  if (val === undefined || val === null || val === '') return '₹0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '₹0.00';
  const inr = num * rate;
  const sign = inr < 0 ? '-' : '';
  const abs = Math.abs(inr);
  return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Formats a dual currency pair: USD and INR
 */
export function formatDual(val?: number | string | null, rate = DEFAULT_INR_RATE): { usd: string; inr: string } {
  return {
    usd: formatUSD(val),
    inr: formatINR(val, rate),
  };
}

/**
 * Format Indian Date Time: "DD/MM/YYYY, hh:mm:ss A IST"
 */
export function formatIndianDateTime(dateStr?: string | number | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/**
 * Format Indian Date only: "DD/MM/YYYY"
 */
export function formatIndianDate(dateStr?: string | number | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format Indian Short Time: "hh:mm A"
 */
export function formatIndianTime(dateStr?: string | number | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
