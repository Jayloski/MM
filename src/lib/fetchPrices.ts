import 'server-only';
import yahooFinance from 'yahoo-finance2';
import type { PriceBar, TimeframeConfig } from '@/types';

const BATCH_SIZE = 6;
const BATCH_DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  const period1 = new Date();
  period1.setDate(period1.getDate() - config.fetchDays);

  try {
    let bars: PriceBar[];

    if (config.yfInterval === '1d') {
      // historical() is more reliable than chart() for daily data
      const result = await yahooFinance.historical(ticker, {
        period1,
        interval: '1d',
      });

      bars = (result ?? [])
        .filter(q => q.close != null && isFinite(q.close))
        .map(q => ({
          date: q.date.toISOString().split('T')[0],
          close: q.adjClose ?? q.close,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // chart() for intraday — skipInvalidRows prevents validation throws
      const result = await yahooFinance.chart(ticker, {
        period1,
        interval: config.yfInterval,
      });

      bars = (result?.quotes ?? [])
        .filter(q => q.close != null && isFinite(q.close as number))
        .map(q => ({
          date: new Date(q.date).toISOString(),
          close: q.close as number,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return bars.length > 1 ? bars : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fetchPrices] ${ticker}: ${msg}`);
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
    if (i > 0) await sleep(BATCH_DELAY_MS);

    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(t => fetchOneTicker(t, config)));

    results.forEach((result, idx) => {
      const ticker = batch[idx];
      if (result.status === 'fulfilled' && result.value !== null) {
        history[ticker] = result.value;
      } else {
        const reason =
          result.status === 'rejected'
            ? result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
            : 'no data';
        console.warn(`[fetchPrices] skipping ${ticker}: ${reason}`);
        skipped.push(ticker);
      }
    });
  }

  console.log(
    `[fetchPrices] ${Object.keys(history).length} ok, ${skipped.length} skipped`,
    skipped.length ? skipped : '',
  );

  return { history, skipped };
}
