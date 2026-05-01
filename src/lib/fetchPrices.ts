import 'server-only';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

const YF_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';

const BATCH_SIZE = 8;

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  try {
    const period2 = Math.floor(Date.now() / 1000);
    const period1 = Math.floor(period2 - config.fetchDays * 86400);
    const url =
      `${YF_CHART}/${encodeURIComponent(ticker)}` +
      `?interval=${config.yfInterval}&period1=${period1}&period2=${period2}&includePrePost=false`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    const bars: PriceBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      if (close != null && isFinite(close)) {
        bars.push({ date: new Date(timestamps[i] * 1000).toISOString(), close });
      }
    }

    bars.sort((a, b) => a.date.localeCompare(b.date));
    return bars.length > 1 ? bars : null;
  } catch (err) {
    console.error(`[fetch] ${ticker}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function fetchPrices(
  tickers: string[],
  config: TimeframeConfig,
): Promise<{ history: Record<string, PriceBar[]>; skipped: string[] }> {
  const history: Record<string, PriceBar[]> = {};
  const skipped: string[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(t => fetchOneTicker(t, config)));

    results.forEach((result, idx) => {
      const ticker = batch[idx];
      if (result.status === 'fulfilled' && result.value !== null) {
        history[ticker] = result.value;
      } else {
        skipped.push(ticker);
      }
    });
  }

  console.log(`[fetchPrices] ${Object.keys(history).length} ok, ${skipped.length} skipped`);
  return { history, skipped };
}
