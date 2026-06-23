import 'server-only';
import yahooFinance from 'yahoo-finance2';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

yahooFinance.setGlobalConfig({ validation: { logErrors: false, logWarnings: false } });

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 300;
const MAX_RETRIES = 2;

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const period2 = new Date();
      const period1 = new Date();
      period1.setDate(period1.getDate() - config.fetchDays);

      const result = await yahooFinance.chart(ticker, {
        period1,
        period2,
        interval: config.yfInterval,
      });

      const quotes = result?.quotes ?? [];
      const bars: PriceBar[] = quotes
        .filter(q => q.close != null && isFinite(q.close as number))
        .map(q => ({
          date: new Date(q.date).toISOString(),
          close: q.close as number,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return bars.length > 1 ? bars : null;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
        continue;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[fetchPrices] ${ticker} failed:`, err);
      }
      return null;
    }
  }
  return null;
}

/**
 * Fetch price bars for a list of tickers concurrently in batches.
 * Returns a partial result — tickers that fail are excluded.
 */
export async function fetchPrices(
  tickers: string[],
  config: TimeframeConfig,
): Promise<{ history: Record<string, PriceBar[]>; skipped: string[] }> {
  const history: Record<string, PriceBar[]> = {};
  const skipped: string[] = [];

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    if (i > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));

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
