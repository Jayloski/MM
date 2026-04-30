import 'server-only';

function normalizeTimestamp(unixSec: number, interval: string): string {
  const d = new Date(unixSec * 1000);
  if (interval === '1d') {
    // Daily bars: key by date only so instruments on different exchanges align
    return d.toISOString().slice(0, 10);
  }
  // Intraday: truncate to the interval boundary to absorb off-by-a-few-seconds skew
  const ms = d.getTime();
  const intervalMs =
    interval === '60m' ? 60 * 60 * 1000 :
    interval === '15m' ? 15 * 60 * 1000 :
    interval === '5m'  ?  5 * 60 * 1000 :
                          60 * 1000;
  return new Date(Math.floor(ms / intervalMs) * intervalMs).toISOString();
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function fetchYahooChart(
  symbol: string,
  interval: '5m' | '15m' | '60m' | '1d',
  fetchDays: number,
): Promise<{ date: string; close: number }[] | null> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - fetchDays * 24 * 3600;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}&includePrePost=false`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    // Prevent Next.js from caching — we want fresh prices on every API call
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const bars: YahooBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c)) continue;
    bars.push({ date: normalizeTimestamp(timestamps[i], interval), close: c });
  }

  return bars.length > 1 ? bars : null;
}
