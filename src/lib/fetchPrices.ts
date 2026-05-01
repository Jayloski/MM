import 'server-only';
import type { PriceBar } from '@/types';
import type { TimeframeConfig } from '@/types';

// Use webpackIgnore so Node.js loads yahoo-finance2 natively at runtime,
// bypassing webpack's ESM bundling which strips the module's methods.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _yf: any;
async function getYahooFinance() {
  if (!_yf) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import(/* webpackIgnore: true */ 'yahoo-finance2' as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = mod?.default as any;
    console.log('[mod] default type:', typeof d);
    console.log('[mod] own props:', Object.getOwnPropertyNames(d || {}).slice(0, 15).join(', '));
    console.log('[mod] proto props:', Object.getOwnPropertyNames(d?.prototype || {}).slice(0, 15).join(', '));
    console.log('[mod] instance test:', typeof d?.call ? typeof new d()?.chart : 'not a constructor');
    _yf = mod.default ?? mod;
  }
  return _yf;
}

const BATCH_SIZE = 8;

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  try {
    const yahooFinance = await getYahooFinance();
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
    console.error(`[fetch] ES=F only:`, ticker === 'ES=F' ? (err instanceof Error ? err.message : String(err)) : '...');
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
