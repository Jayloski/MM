import { pearson } from '@/lib/correlation';
import type { AssetClass, DivergencePair } from '@/types';

interface AssetMeta {
  label: string;
  assetClass: AssetClass;
}

function rollingSum(returns: number[], w: number): number[] {
  const result: number[] = [];
  let sum = 0;
  for (let i = 0; i < returns.length; i++) {
    sum += isFinite(returns[i]) ? returns[i] : 0;
    if (i >= w) sum -= isFinite(returns[i - w]) ? returns[i - w] : 0;
    if (i >= w - 1) result.push(sum);
  }
  return result;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], m: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/** Align two return maps by pairwise shared dates, returning last N as arrays. */
function alignPair(
  mapA: Map<string, number>,
  mapB: Map<string, number>,
  lookbackBars: number,
): [number[], number[]] {
  const shared: string[] = [];
  for (const d of mapA.keys()) {
    if (mapB.has(d)) shared.push(d);
  }
  const dates = shared.sort().slice(-lookbackBars);
  return [
    dates.map(d => { const v = mapA.get(d)!; return isFinite(v) ? v : 0; }),
    dates.map(d => { const v = mapB.get(d)!; return isFinite(v) ? v : 0; }),
  ];
}

export function computeDivergencePairs(
  returnMaps: Map<string, Map<string, number>>,
  tickers: string[],
  assetMeta: Map<string, AssetMeta>,
  shortWindow: number,
  minR: number,
  lookbackBars: number,
): DivergencePair[] {
  const valid = tickers.filter(t => returnMaps.has(t));
  const results: DivergencePair[] = [];

  for (let i = 0; i < valid.length; i++) {
    const tA = valid[i];
    const mapA = returnMaps.get(tA)!;
    const mA = assetMeta.get(tA);
    if (!mA) continue;

    for (let j = i + 1; j < valid.length; j++) {
      const tB = valid[j];
      const mapB = returnMaps.get(tB)!;
      const mB = assetMeta.get(tB);
      if (!mB) continue;

      const [sA, sB] = alignPair(mapA, mapB, lookbackBars);
      if (sA.length < shortWindow + 10) continue;

      const longR = pearson(sA, sB);
      if (!isFinite(longR) || Math.abs(longR) < minR) continue;

      const n = sA.length;
      const cumA = sA.slice(n - shortWindow).reduce((s, v) => s + v, 0);
      const cumB = sB.slice(n - shortWindow).reduce((s, v) => s + v, 0);

      const rollA = rollingSum(sA, shortWindow);
      const rollB = rollingSum(sB, shortWindow);
      const spreadSeries = rollA.map((a, k) => a - rollB[k]);

      const spreadMean = mean(spreadSeries);
      const spreadStd = std(spreadSeries, spreadMean);
      if (spreadStd === 0) continue;

      const spreadZ = (cumA - cumB - spreadMean) / spreadStd;
      if (Math.abs(spreadZ) < 1.5) continue;

      const moverIsA = Math.abs(cumA) > Math.abs(cumB);

      const zSeries = spreadSeries.map(s => (s - spreadMean) / spreadStd);
      const checkableEnd = zSeries.length - shortWindow - 1;
      let instances = 0;
      let resolutions = 0;

      for (let k = 0; k <= checkableEnd; k++) {
        if (Math.abs(zSeries[k]) <= 1.0) continue;
        instances++;

        const aWasMover = Math.abs(rollA[k]) > Math.abs(rollB[k]);
        const moverDir = aWasMover ? Math.sign(rollA[k]) : Math.sign(rollB[k]);
        const flatNow   = aWasMover ? rollB[k] : rollA[k];
        const flatLater = aWasMover ? rollB[k + shortWindow] : rollA[k + shortWindow];
        const flatMove  = flatLater - flatNow;
        const threshold = Math.abs(aWasMover ? rollA[k] : rollB[k]) * 0.25;

        if (moverDir * flatMove > threshold) resolutions++;
      }

      results.push({
        tickerA: tA, tickerB: tB,
        labelA: mA.label, labelB: mB.label,
        assetClassA: mA.assetClass, assetClassB: mB.assetClass,
        longR, spreadZ, cumA, cumB, moverIsA,
        continuationRate: instances >= 5 ? resolutions / instances : null,
      });
    }
  }

  return results.sort((a, b) => Math.abs(b.spreadZ) - Math.abs(a.spreadZ));
}
