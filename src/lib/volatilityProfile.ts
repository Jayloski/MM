import type { PriceBar, VolatilityProfile } from '@/types';

/** Returns pip denominator for forex tickers, null for futures */
function pipSize(ticker: string): number | null {
  // Only forex tickers contain '=' (e.g. EURUSD=X, CAD=X)
  if (!ticker.includes('=') && !ticker.includes('-Y')) return null;
  // JPY crosses: 1 pip = 0.01
  if (/JPY/i.test(ticker)) return 0.01;
  // All other forex: 1 pip = 0.0001
  return 0.0001;
}

export function computeVolatilityProfile(
  ticker: string,
  bars: PriceBar[],
): VolatilityProfile {
  const pip = pipSize(ticker);
  const unit: VolatilityProfile['unit'] = pip != null ? 'pips' : 'pct';

  // Accumulators: sum and count per UTC hour (0-23) and UTC day (0-6)
  const hourSum   = new Array(24).fill(0);
  const hourCount = new Array(24).fill(0);
  const daySum    = new Array(7).fill(0);
  const dayCount  = new Array(7).fill(0);

  for (const bar of bars) {
    if (bar.high == null || bar.low == null) continue;
    const range = bar.high - bar.low;
    if (!isFinite(range) || range <= 0) continue;

    // Convert to display unit
    const value = pip != null
      ? range / pip
      : (range / bar.close) * 100;

    const dt = new Date(bar.date);
    const hour = dt.getUTCHours();
    const day  = dt.getUTCDay();

    hourSum[hour]   += value;
    hourCount[hour] += 1;
    daySum[day]     += value;
    dayCount[day]   += 1;
  }

  const hourly = hourSum.map((s, i) => hourCount[i] > 0 ? s / hourCount[i] : 0);
  const daily  = daySum.map((s, i)  => dayCount[i]  > 0 ? s / dayCount[i]  : 0);

  return { hourly, daily, unit };
}
