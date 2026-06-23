import 'server-only';
import type { PriceBar, TimeframeConfig } from '@/types';

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Yahoo Finance interval strings
const YF_INTERVAL_MAP: Record<string, string> = {
  '5m': '5m',
  '15m': '15m',
  '60m': '60m',
  '1d': '1d',
};

// Yahoo Finance range strings based on fetchDays
function daysToRange(days: number): string {
  if (days <= 7)   return '5d';
  if (days <= 30)  return '1mo';
  if (days <= 90)  return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  return '2y';
}

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  const interval = YF_INTERVAL_MAP[config.yfInterval] ?? config.yfInterval;
  const range = daysToRange(config.fetchDays);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`;

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(800);
    try {
      const res = await fetch(url, { headers, next: { revalidate: 0 } });
      if (!res.ok) {
        console.error(`[fetchPrices] ${ticker} HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const timestamps: number[] = result.timestamp ?? [];
      const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

      // Normalize date keys so cross-market timestamps align:
      // daily → YYYY-MM-DD only; intraday → round down to interval boundary
      const intervalMs = config.yfInterval === '1d' ? 0
        : config.yfInterval === '60m' ? 3_600_000
        : config.yfInterval === '15m' ? 900_000
        : 300_000; // 5m

      const bars: PriceBar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (close == null || !isFinite(close)) continue;
        const ms = timestamps[i] * 1000;
        const date = config.yfInterval === '1d'
          ? new Date(ms).toISOString().slice(0, 10)         // YYYY-MM-DD
          : new Date(Math.floor(ms / intervalMs) * intervalMs).toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
        bars.push({ date, close });
      }
      bars.sort((a, b) => a.date.localeCompare(b.date));
      return bars.length > 1 ? bars : null;
    } catch (err) {
      console.error(`[fetchPrices] ${ticker} attempt ${attempt + 1} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

export async function fetchPrices(
  tickers: string[],
  config: TimeframeConfig,
): Promise<{ history: Record<string, PriceBar[]>; skipped: string[] }> {
  const history: Record<string, PriceBar[]> = {};
  const skipped: string[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    if (i > 0) await sleep(BATCH_DELAY_MS);
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(t => fetchOneTicker(t, config)),
    );

    results.forEach((result, idx) => {
      const ticker = batch[idx];
      if (result.status === 'fulfilled' && result.value !== null) {
        history[ticker] = result.value;
      } else {
        skipped.push(ticker);
      }
    });
  }

  return { history, skipped };
}
