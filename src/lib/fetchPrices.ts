import 'server-only';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const yahooFinance: any = require('yahoo-finance2').default ?? require('yahoo-finance2');

const BATCH_SIZE = 4;
const BATCH_DELAY_MS = 400;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
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
    console.error(`[fetchPrices] ${ticker} failed:`, err instanceof Error ? err.message : err);
    // retry once after a short delay
    await sleep(600);
    try {
      const period2 = new Date();
      const period1 = new Date();
      period1.setDate(period1.getDate() - config.fetchDays);
      const result = await yahooFinance.chart(ticker, { period1, period2, interval: config.yfInterval });
      const quotes = result?.quotes ?? [];
      const bars: PriceBar[] = quotes
        .filter(q => q.close != null && isFinite(q.close as number))
        .map(q => ({ date: new Date(q.date).toISOString(), close: q.close as number }))
        .sort((a, b) => a.date.localeCompare(b.date));
      return bars.length > 1 ? bars : null;
    } catch (err2) {
      console.error(`[fetchPrices] ${ticker} retry failed:`, err2 instanceof Error ? err2.message : err2);
      return null;
    }
  }
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
