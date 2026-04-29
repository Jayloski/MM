import 'server-only';
import type { PriceBar, TimeframeConfig } from '@/types';

const YF_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart';
const FALLBACK_HOST = 'https://query2.finance.yahoo.com/v8/finance/chart';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 600;

/**
 * Normalise a Unix timestamp to a string key that is identical for the same
 * bar across different asset classes regardless of their intraday offset.
 *
 * Daily  → "2024-01-15"          (date only — stable across timezones)
 * 60m    → "2024-01-15T14"       (hour bucket)
 * 15m    → "2024-01-15T14:30"    (15-min bucket, rounded down)
 * 5m     → "2024-01-15T14:30"    (5-min bucket, rounded down)
 */
function normaliseTimestamp(unixSec: number, interval: string): string {
  const d = new Date(unixSec * 1000);
  const yyyy = d.getUTCFullYear();
  const mm   = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd   = String(d.getUTCDate()).padStart(2, '0');
  if (interval === '1d') return `${yyyy}-${mm}-${dd}`;
  const hh   = String(d.getUTCHours()).padStart(2, '0');
  if (interval === '60m') return `${yyyy}-${mm}-${dd}T${hh}`;
  const min  = d.getUTCMinutes();
  const step = interval === '15m' ? 15 : 5;
  const minBucket = String(Math.floor(min / step) * step).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${minBucket}`;
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

interface YFQuote {
  close: (number | null)[];
}

interface YFAdjClose {
  adjclose: (number | null)[];
}

interface YFChartResult {
  timestamp: number[];
  indicators: {
    quote: YFQuote[];
    adjclose?: YFAdjClose[];
  };
}

interface YFChartResponse {
  chart: {
    result: YFChartResult[] | null;
    error: { description: string } | null;
  };
}

async function fetchChart(
  host: string,
  ticker: string,
  interval: string,
  period1: number,
  period2: number,
): Promise<YFChartResponse> {
  const url =
    `${host}/${encodeURIComponent(ticker)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}` +
    `&includePrePost=false&events=`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${host}`);
  return res.json() as Promise<YFChartResponse>;
}

async function fetchOneTicker(
  ticker: string,
  config: TimeframeConfig,
): Promise<PriceBar[] | null> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - config.fetchDays * 86400;

  let json: YFChartResponse;
  try {
    json = await fetchChart(YF_CHART, ticker, config.yfInterval, period1, period2);
  } catch (e1) {
    try {
      // Fallback to query2 host
      json = await fetchChart(FALLBACK_HOST, ticker, config.yfInterval, period1, period2);
    } catch (e2) {
      console.warn(`[fetchPrices] ${ticker}: both hosts failed — ${e2 instanceof Error ? e2.message : e2}`);
      return null;
    }
  }

  const result = json?.chart?.result?.[0];
  if (!result) {
    const errDesc = json?.chart?.error?.description ?? 'empty result';
    console.warn(`[fetchPrices] ${ticker}: ${errDesc}`);
    return null;
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose ?? [];

  const bars: PriceBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = adjCloses[i] ?? closes[i];
    if (close != null && isFinite(close) && close > 0) {
      bars.push({
        date: normaliseTimestamp(timestamps[i], config.yfInterval),
        close,
      });
    }
  }

  bars.sort((a, b) => a.date.localeCompare(b.date));

  if (bars.length < 2) {
    console.warn(`[fetchPrices] ${ticker}: only ${bars.length} bar(s) after filtering`);
    return null;
  }

  return bars;
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
        console.warn(`[fetchPrices] skip ${ticker}: ${reason}`);
        skipped.push(ticker);
      }
    });
  }

  console.log(
    `[fetchPrices] done — ${Object.keys(history).length} ok / ${skipped.length} skipped`,
    skipped.length ? `(${skipped.join(', ')})` : '',
  );

  return { history, skipped };
}
