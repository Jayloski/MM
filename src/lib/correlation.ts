import type { PriceBar } from '@/types';

/**
 * Compute percentage returns from a sorted price series.
 * Filters out NaN / Infinity that arise from zero or missing prices.
 */
export function computeReturns(bars: PriceBar[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 1; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    const curr = bars[i].close;
    if (!prev || !curr || !isFinite(prev) || !isFinite(curr)) continue;
    const ret = (curr - prev) / prev;
    if (isFinite(ret)) {
      map.set(bars[i].date, ret);
    }
  }
  return map;
}

/**
 * Resample bars by taking every `factor`-th bar, then computing returns on that sparse series.
 * Used to synthesise 4h bars from 1h data.
 */
export function resampleBars(bars: PriceBar[], factor: number): PriceBar[] {
  const result: PriceBar[] = [];
  for (let i = 0; i < bars.length; i += factor) {
    result.push(bars[i]);
  }
  return result;
}

/**
 * Align multiple return series to their shared date keys and return
 * the last `lookbackBars` aligned values per ticker.
 */
export function alignReturns(
  returnMaps: Map<string, Map<string, number>>,
  lookbackBars: number,
): Map<string, number[]> {
  // Find intersection of date keys across all tickers
  let sharedDates: Set<string> | null = null;
  for (const [, retMap] of returnMaps) {
    const dates = new Set(retMap.keys());
    if (sharedDates === null) {
      sharedDates = dates;
    } else {
      for (const d of sharedDates) {
        if (!dates.has(d)) sharedDates.delete(d);
      }
    }
  }

  if (!sharedDates || sharedDates.size === 0) {
    // Return empty arrays if no overlap
    const empty = new Map<string, number[]>();
    for (const [ticker] of returnMaps) empty.set(ticker, []);
    return empty;
  }

  // Sort dates ascending and slice to lookback window
  const sortedDates = Array.from(sharedDates).sort().slice(-lookbackBars);

  const aligned = new Map<string, number[]>();
  for (const [ticker, retMap] of returnMaps) {
    aligned.set(ticker, sortedDates.map(d => retMap.get(d) ?? NaN));
  }
  return aligned;
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns NaN if n < 2 or variance is zero.
 */
export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return NaN;

  let sumA = 0, sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let num = 0, dA = 0, dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    dA  += da * da;
    dB  += db * db;
  }

  const denom = Math.sqrt(dA * dB);
  return denom === 0 ? NaN : num / denom;
}

/**
 * Build an n×n Pearson correlation matrix using pairwise date intersection.
 * Each pair independently intersects its own date keys, avoiding the global
 * intersection collapse that occurs with cross-asset intraday data.
 */
export function buildCorrelationMatrix(
  tickers: string[],
  returnMaps: Map<string, Map<string, number>>,
  lookbackBars: number,
): (number | null)[][] {
  const n = tickers.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    new Array<number | null>(n).fill(null),
  );

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    const mapA = returnMaps.get(tickers[i]);
    if (!mapA) continue;
    for (let j = i + 1; j < n; j++) {
      const mapB = returnMaps.get(tickers[j]);
      if (!mapB) continue;

      // Pairwise intersection of date keys
      const pairDates = Array.from(mapA.keys())
        .filter(d => mapB.has(d))
        .sort()
        .slice(-lookbackBars);

      if (pairDates.length < 2) continue;

      const a = pairDates.map(d => mapA.get(d)!);
      const b = pairDates.map(d => mapB.get(d)!);
      const r = pearson(a, b);
      const val = isFinite(r) ? parseFloat(r.toFixed(4)) : null;
      matrix[i][j] = val;
      matrix[j][i] = val;
    }
  }

  return matrix;
}
