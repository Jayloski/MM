import 'server-only';
import { fetchYahooChart } from '@/lib/yahooApi';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

const BATCH_SIZE = 8;

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  try {
    const bars = await fetchYahooChart(ticker, config.yfInterval, config.fetchDays);
    if (!bars) return null;
    const priceBars: PriceBar[] = bars.map(b => ({ date: b.date, close: b.close }));
    return priceBars.length > 1 ? priceBars : null;
  } catch {
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
