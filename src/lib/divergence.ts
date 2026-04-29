import type { DivergencePair, AssetClass } from '@/types';

export interface DivergenceParams {
  shortWindow: number;   // bars for "recent" cumulative move (default 3)
  zThreshold: number;    // sigma threshold to flag active divergence (default 1.5)
  forwardBars: number;   // bars to check for follow-through (default 10)
  minCorr: number;       // minimum long-window |r| to consider pair (default 0.7)
  minSamples: number;    // minimum historical signals needed to show probability
}

export const DEFAULT_DIVERGENCE_PARAMS: DivergenceParams = {
  shortWindow:  3,
  zThreshold:   1.5,
  forwardBars:  10,
  minCorr:      0.7,
  minSamples:   5,
};

/**
 * Build a sliding-window sum of length `w` over an array.
 * slidingSums[t] = arr[t] + arr[t+1] + ... + arr[t+w-1]
 * Result length = arr.length - w + 1
 */
function slidingSums(arr: number[], w: number): number[] {
  if (arr.length < w) return [];
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < w; i++) sum += arr[i];
  out.push(sum);
  for (let i = w; i < arr.length; i++) {
    sum += arr[i] - arr[i - w];
    out.push(sum);
  }
  return out;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], m: number): number {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

interface SpreadZResult {
  z: number;
  recentA: number;
  recentB: number;
  spreadStd: number;
  spreadMean: number;
}

/**
 * Compute the Z-score of the current short-window spread between two aligned return series.
 * Returns null if there is not enough data.
 */
export function computeSpreadZ(
  retA: number[],
  retB: number[],
  shortWindow: number,
): SpreadZResult | null {
  const n = Math.min(retA.length, retB.length);
  // Need enough bars to compute history + current window
  if (n < shortWindow * 3) return null;

  const spread = Array.from({ length: n }, (_, i) => retA[i] - retB[i]);

  // Historical sliding sums — exclude the last shortWindow bars (current window)
  const histSpread = spread.slice(0, n - shortWindow);
  const histSums = slidingSums(histSpread, shortWindow);
  if (histSums.length < 2) return null;

  const m = mean(histSums);
  const s = std(histSums, m);
  if (s === 0) return null;

  // Current window: last shortWindow bars
  const recentA = retA.slice(n - shortWindow).reduce((a, b) => a + b, 0);
  const recentB = retB.slice(n - shortWindow).reduce((a, b) => a + b, 0);
  const currentSpread = recentA - recentB;

  return {
    z: (currentSpread - m) / s,
    recentA,
    recentB,
    spreadStd: s,
    spreadMean: m,
  };
}

interface FollowThroughResult {
  prob: number;
  sampleCount: number;
}

/**
 * Scan historical spread for past divergences matching the current direction,
 * then compute the rate at which they converged within forwardBars.
 * "Converged" = absolute spread reduced by ≥50% within forwardBars.
 */
export function computeFollowThroughProb(
  retA: number[],
  retB: number[],
  shortWindow: number,
  zThreshold: number,
  forwardBars: number,
  currentZ: number,
): FollowThroughResult {
  const n = Math.min(retA.length, retB.length);
  const spread = Array.from({ length: n }, (_, i) => retA[i] - retB[i]);

  // All sliding sums (full series, used for scanning history)
  const allSums = slidingSums(spread, shortWindow);
  if (allSums.length < 2) return { prob: 0, sampleCount: 0 };

  const m = mean(allSums.slice(0, allSums.length - 1));
  const s = std(allSums.slice(0, allSums.length - 1), m);
  if (s === 0) return { prob: 0, sampleCount: 0 };

  const sameDir = currentZ > 0;
  let signals = 0;
  let convergences = 0;

  // Scan all windows that have forwardBars room ahead, excluding the current window
  const scanEnd = allSums.length - forwardBars - 1;
  for (let t = 0; t < scanEnd; t++) {
    const z = (allSums[t] - m) / s;
    if (Math.abs(z) < zThreshold) continue;
    if ((z > 0) !== sameDir) continue; // only same direction as current signal

    signals++;
    const future = allSums[t + forwardBars];
    if (Math.abs(future) < Math.abs(allSums[t]) * 0.5) {
      convergences++;
    }
  }

  return {
    prob: signals > 0 ? convergences / signals : 0,
    sampleCount: signals,
  };
}

/**
 * Scan all pairs from the aligned return map, find active divergences,
 * and compute follow-through probabilities.
 */
export function scanDivergences(
  tickers: string[],
  labels: Record<string, string>,
  assetClasses: Record<string, string>,
  subGroups: Record<string, string>,
  matrix: (number | null)[][],
  aligned: Map<string, number[]>,
  params: DivergenceParams,
): DivergencePair[] {
  const { shortWindow, zThreshold, forwardBars, minCorr, minSamples } = params;
  const results: DivergencePair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tickers.length; i++) {
    for (let j = i + 1; j < tickers.length; j++) {
      const r = matrix[i][j];
      if (r == null || Math.abs(r) < minCorr) continue;

      const a = tickers[i];
      const b = tickers[j];
      const pairKey = [a, b].sort().join(':');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const retA = aligned.get(a);
      const retB = aligned.get(b);
      if (!retA || !retB) continue;

      const zResult = computeSpreadZ(retA, retB, shortWindow);
      if (!zResult) continue;
      if (Math.abs(zResult.z) < zThreshold) continue;

      const { prob, sampleCount } = computeFollowThroughProb(
        retA, retB, shortWindow, zThreshold, forwardBars, zResult.z,
      );

      // z > 0 means A moved more than B → A is leader, B is lagger
      // z < 0 means B moved more than A → B is leader, A is lagger
      const aIsLeader = zResult.z > 0;
      const [leaderTicker, laggerTicker] = aIsLeader ? [a, b] : [b, a];
      const [leaderRecent, laggerRecent] = aIsLeader
        ? [zResult.recentA, zResult.recentB]
        : [zResult.recentB, zResult.recentA];

      results.push({
        leaderTicker,
        laggerTicker,
        leaderLabel:      labels[leaderTicker]     ?? leaderTicker,
        laggerLabel:      labels[laggerTicker]     ?? laggerTicker,
        leaderAssetClass: (assetClasses[leaderTicker] as AssetClass) ?? 'futures',
        laggerAssetClass: (assetClasses[laggerTicker] as AssetClass) ?? 'futures',
        leaderSubGroup:   subGroups[leaderTicker]  ?? '',
        laggerSubGroup:   subGroups[laggerTicker]  ?? '',
        correlation:      parseFloat(r.toFixed(3)),
        spreadZ:          parseFloat(zResult.z.toFixed(2)),
        leaderRecentPct:  parseFloat((leaderRecent * 100).toFixed(3)),
        laggerRecentPct:  parseFloat((laggerRecent * 100).toFixed(3)),
        followThroughProb: sampleCount >= minSamples ? parseFloat(prob.toFixed(3)) : null,
        sampleCount,
        direction: leaderRecent > 0 ? 'long' : 'short',
      });
    }
  }

  // Sort by conviction: prob * |z| (or just |z| when prob is null)
  return results.sort((a, b) => {
    const scoreA = (a.followThroughProb ?? 0.5) * Math.abs(a.spreadZ);
    const scoreB = (b.followThroughProb ?? 0.5) * Math.abs(b.spreadZ);
    return scoreB - scoreA;
  });
}
