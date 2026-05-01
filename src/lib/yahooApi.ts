import 'server-only';

function normalizeTimestamp(unixSec: number, interval: string): string {
  const d = new Date(unixSec * 1000);
  if (interval === '1d') {
    return d.toISOString().slice(0, 10);
  }
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
  // Daily: period1/period2 gives the full history range we need.
  // Intraday: Yahoo Finance is more reliable with the ?range=Nd param.
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - fetchDays * 24 * 3600;

  const qs =
    interval === '1d'
      ? `interval=1d&period1=${period1}&period2=${period2}`
      : `interval=${interval}&range=${fetchDays}d&includePrePost=false`;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${qs}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const bars: { date: string; close: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c)) continue;
    bars.push({ date: normalizeTimestamp(timestamps[i], interval), close: c });
  }

  return bars.length > 1 ? bars : null;
}
