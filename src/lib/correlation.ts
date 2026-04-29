import type { PriceBar, DivergenceRow } from '@/types';

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
 * Build an n×n Pearson correlation matrix from aligned returns.
 * matrix[i][j] = r; matrix[i][i] = 1.
 */
export function buildCorrelationMatrix(
  tickers: string[],
  aligned: Map<string, number[]>,
): (number | null)[][] {
  const n = tickers.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () =>
    new Array<number | null>(n).fill(null),
  );

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    const a = aligned.get(tickers[i]) ?? [];
    for (let j = i + 1; j < n; j++) {
      const b = aligned.get(tickers[j]) ?? [];
      const r = pearson(a, b);
      const val = isFinite(r) ? parseFloat(r.toFixed(4)) : null;
      matrix[i][j] = val;
      matrix[j][i] = val;
    }
  }

  return matrix;
}

// ── Divergence helpers ────────────────────────────────────────────────────────

function cumReturn(returns: number[], start: number, length: number): number {
  let product = 1;
  const end = Math.min(start + length, returns.length);
  for (let i = start; i < end; i++) {
    if (!isFinite(returns[i])) return NaN;
    product *= 1 + returns[i];
  }
  return product - 1;
}

function arrayMean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function arrayStd(arr: number[], mu?: number): number {
  const m = mu ?? arrayMean(arr);
  const variance = arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Compute a divergence row for a single pair given their aligned return arrays.
 * Returns null if the pair doesn't meet correlation or spread-Z thresholds.
 *
 * baseBars  – how many bars to treat as the full analysis window (e.g. 60)
 * momBars   – momentum (recent) sub-window (e.g. 20)
 * scanStep  – step between historical scan windows (e.g. 5)
 * corrMinAbs – minimum |baseline r| to proceed (e.g. 0.60)
 * minSpreadZ – minimum |spreadZ| to include the row (e.g. 0.75)
 */
export function computeDivergenceRow(
  tickerA: string,
  tickerB: string,
  labelA: string,
  labelB: string,
  fullA: number[],
  fullB: number[],
  baseBars: number,
  momBars: number,
  scanStep: number,
  corrMinAbs: number,
  minSpreadZ: number,
): DivergenceRow | null {
  if (fullA.length < baseBars || fullB.length < baseBars) return null;

  // Use only the last baseBars of the aligned series
  const rA = fullA.slice(-baseBars);
  const rB = fullB.slice(-baseBars);

  // Baseline Pearson r over the full window
  const corrBaseline = pearson(rA, rB);
  if (!isFinite(corrBaseline) || Math.abs(corrBaseline) < corrMinAbs) return null;

  const currentStart = baseBars - momBars; // index into rA/rB where the momentum window begins

  // Historical scan windows: all positions where we still have a full "next" window
  const histStarts: number[] = [];
  for (let t = 0; t + 2 * momBars <= baseBars; t += scanStep) {
    if (t + momBars !== currentStart) {
      // exclude the window immediately before current (would alias the current signal)
      histStarts.push(t);
    }
  }
  if (histStarts.length === 0) return null;

  // Historical spread and solo-momentum distributions
  const histSpreads = histStarts.map(t => {
    const s = cumReturn(rA, t, momBars) - cumReturn(rB, t, momBars);
    return isFinite(s) ? s : NaN;
  }).filter(isFinite);
  const histMomA = histStarts.map(t => cumReturn(rA, t, momBars)).filter(isFinite);
  const histMomB = histStarts.map(t => cumReturn(rB, t, momBars)).filter(isFinite);

  if (histSpreads.length < 2 || histMomA.length < 2 || histMomB.length < 2) return null;

  const spreadMean = arrayMean(histSpreads);
  const spreadStd  = arrayStd(histSpreads, spreadMean);
  const momMeanA   = arrayMean(histMomA);
  const momStdA    = arrayStd(histMomA, momMeanA);
  const momMeanB   = arrayMean(histMomB);
  const momStdB    = arrayStd(histMomB, momMeanB);

  if (spreadStd === 0 || momStdA === 0 || momStdB === 0) return null;

  // Current-window metrics
  const currentRetA = cumReturn(rA, currentStart, momBars);
  const currentRetB = cumReturn(rB, currentStart, momBars);
  if (!isFinite(currentRetA) || !isFinite(currentRetB)) return null;

  const currentSpread = currentRetA - currentRetB;
  const spreadZ = (currentSpread - spreadMean) / spreadStd;
  if (!isFinite(spreadZ) || Math.abs(spreadZ) < minSpreadZ) return null;

  const momZA = (currentRetA - momMeanA) / momStdA;
  const momZB = (currentRetB - momMeanB) / momStdB;

  // Mover = asset with larger |momZ|; Holdout = other
  const aIsM = Math.abs(momZA) >= Math.abs(momZB);
  const moverTicker   = aIsM ? tickerA : tickerB;
  const moverLabel    = aIsM ? labelA  : labelB;
  const moverReturn   = aIsM ? currentRetA : currentRetB;
  const moverMomZ     = aIsM ? momZA : momZB;
  const holdoutTicker = aIsM ? tickerB : tickerA;
  const holdoutLabel  = aIsM ? labelB  : labelA;
  const holdoutReturn = aIsM ? currentRetB : currentRetA;
  const holdoutMomZ   = aIsM ? momZB : momZA;

  // Historical backtest
  const minHistZ = 0.5;
  let sampleN = 0;
  let revertCount = 0;
  let lagCount = 0;

  for (const t of histStarts) {
    const hSpread = cumReturn(rA, t, momBars) - cumReturn(rB, t, momBars);
    if (!isFinite(hSpread)) continue;
    const hSpreadZ = (hSpread - spreadMean) / spreadStd;
    if (!isFinite(hSpreadZ) || Math.abs(hSpreadZ) < minHistZ) continue;
    if (Math.sign(hSpreadZ) !== Math.sign(spreadZ)) continue;

    const nextStart = t + momBars;
    if (nextStart + momBars > baseBars) continue;

    sampleN++;

    const nextSpread = cumReturn(rA, nextStart, momBars) - cumReturn(rB, nextStart, momBars);
    if (isFinite(nextSpread)) {
      const nextSpreadZ = (nextSpread - spreadMean) / spreadStd;
      if (Math.abs(nextSpreadZ) < Math.abs(hSpreadZ)) revertCount++;
    }

    // Lag: did the holdout move in the mover's historical direction in the next window?
    const hMoverRet   = aIsM ? cumReturn(rA, t, momBars) : cumReturn(rB, t, momBars);
    const nextHoldout = aIsM ? cumReturn(rB, nextStart, momBars) : cumReturn(rA, nextStart, momBars);
    if (isFinite(hMoverRet) && isFinite(nextHoldout) && Math.sign(nextHoldout) === Math.sign(hMoverRet)) {
      lagCount++;
    }
  }

  return {
    tickerA,
    tickerB,
    labelA,
    labelB,
    corrBaseline: parseFloat(corrBaseline.toFixed(4)),
    moverTicker,
    moverLabel,
    moverReturn,
    moverMomZ,
    holdoutTicker,
    holdoutLabel,
    holdoutReturn,
    holdoutMomZ,
    spreadZ,
    sampleN,
    revertPct: sampleN > 0 ? revertCount / sampleN : null,
    lagPct:    sampleN > 0 ? lagCount    / sampleN : null,
  };
}
