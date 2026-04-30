import 'server-only';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

// Use require to force CJS path — avoids webpack ESM/CJS interop breaking
// yahoo-finance2's internal dynamic requires
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yf = require('yahoo-finance2');
// The package exports a default instance; handle both CJS and ESM shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yahooFinance: any = yf.default ?? yf;

try {
  yahooFinance.suppressNotices?.(['yahooSurvey', 'ripHistorical']);
} catch { /* ignore */ }

const BATCH_SIZE = 8;

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  try {
    const period2 = new Date();
    const period1 = new Date();
    period1.setDate(period1.getDate() - config.fetchDays);

    const result = await yahooFinance.chart(
      ticker,
      { period1, period2, interval: config.yfInterval },
      { validateResult: false },
    );

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
    console.error(`[fetchPrices] ${ticker}:`, err instanceof Error ? err.message : err);
    return null;
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
