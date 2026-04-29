import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { cacheGet, cacheSet } from '@/lib/cache';
import { computeReturns, resampleBars, filterSessionBars, pearson } from '@/lib/correlation';
import type { Timeframe, AssetClass, DivergencePair, DivergenceResponse } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

const DEFAULT_SHORT = 20;
const DEFAULT_LONG  = 60;
const TOP_N = 30;

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], mu = mean(arr)): number {
  return Math.sqrt(arr.reduce((s, v) => s + (v - mu) ** 2, 0) / arr.length);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1d';

  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter((c): c is AssetClass => VALID_CLASSES.has(c as AssetClass)))
    : ALL_ASSET_CLASSES;

  const shortWindow = Math.max(5,  parseInt(searchParams.get('shortWindow') ?? String(DEFAULT_SHORT), 10) || DEFAULT_SHORT);
  const longWindow  = Math.max(10, parseInt(searchParams.get('longWindow')  ?? String(DEFAULT_LONG),  10) || DEFAULT_LONG);

  const modeParam = searchParams.get('mode') ?? 'correlation';
  const mode: 'correlation' | 'spread' = modeParam === 'spread' ? 'spread' : 'correlation';
  const minLongR = parseFloat(searchParams.get('minLongR') ?? '0') || 0;

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes requested' }, { status: 400 });
  }

  const config = TIMEFRAME_CONFIGS[timeframe];
  const ttl = config.cacheTtlSeconds;
  const cacheHeaders = {
    'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  };

  const cacheKey = `div:${timeframe}:${shortWindow}:${longWindow}:${mode}:${minLongR.toFixed(3)}:${[...requestedClasses].sort().join(',')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), { headers: cacheHeaders });
  }

  const extraFactor = Math.ceil((longWindow * 2) / config.lookbackBars) + 1;
  const histConfig = { ...config, fetchDays: config.fetchDays * extraFactor };

  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);
  const assetMap = new Map(assets.map(a => [a.ticker, a]));

  const { history, skipped } = await fetchPrices(tickers, histConfig);

  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    if (skipped.includes(ticker)) continue;
    const resampled = config.resampleFactor ? resampleBars(bars, config.resampleFactor) : bars;
    const processed = config.sessionFilter ? filterSessionBars(resampled, config.sessionFilter) : resampled;
    const retMap = computeReturns(processed);
    if (retMap.size >= longWindow + 1) {
      returnMaps.set(ticker, retMap);
    }
  }

  const available = Array.from(returnMaps.keys());
  if (available.length < 2) {
    return NextResponse.json({ error: 'Insufficient data for divergence scan' }, { status: 502 });
  }

  const divergentPairs: DivergencePair[] = [];

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const ta = available[i];
      const tb = available[j];
      const retA = returnMaps.get(ta)!;
      const retB = returnMaps.get(tb)!;

      const shared = Array.from(retA.keys()).filter(d => retB.has(d)).sort();
      if (shared.length < longWindow + 1) continue;

      const longDates  = shared.slice(-longWindow);
      const shortDates = shared.slice(-shortWindow);

      const arrLongA  = longDates.map(d => retA.get(d)!);
      const arrLongB  = longDates.map(d => retB.get(d)!);
      const arrShortA = shortDates.map(d => retA.get(d)!);
      const arrShortB = shortDates.map(d => retB.get(d)!);

      const longR  = pearson(arrLongA, arrLongB);
      const shortR = pearson(arrShortA, arrShortB);

      if (!isFinite(longR) || !isFinite(shortR)) continue;

      if (mode === 'correlation') {
        divergentPairs.push({
          a: ta, b: tb,
          aLabel: assetMap.get(ta)?.label ?? ta,
          bLabel: assetMap.get(tb)?.label ?? tb,
          shortR:     parseFloat(shortR.toFixed(4)),
          longR:      parseFloat(longR.toFixed(4)),
          divergence: parseFloat(Math.abs(shortR - longR).toFixed(4)),
        });
      } else {
        // Spread mode: only process pairs with sufficient long-window correlation
        if (Math.abs(longR) < minLongR) continue;

        const spreadLong = longDates.map((d, k) => arrLongA[k] - arrLongB[k]);
        const mean_s = mean(spreadLong);
        const std_s  = std(spreadLong, mean_s);

        const cumA = arrShortA.reduce((s, v) => s + v, 0);
        const cumB = arrShortB.reduce((s, v) => s + v, 0);
        const cumSpread = cumA - cumB;

        const expectedStd = std_s * Math.sqrt(shortWindow);
        const spreadZ = expectedStd > 0
          ? (cumSpread - mean_s * shortWindow) / expectedStd
          : 0;

        // ── Individual leg momentum Z ────────────────────────────────────
        const meanA = mean(arrLongA), stdA = std(arrLongA, meanA);
        const denom_A = stdA * Math.sqrt(shortWindow);
        const momentumZA = denom_A > 0 ? (cumA - meanA * shortWindow) / denom_A : 0;

        const meanB = mean(arrLongB), stdB = std(arrLongB, meanB);
        const denom_B = stdB * Math.sqrt(shortWindow);
        const momentumZB = denom_B > 0 ? (cumB - meanB * shortWindow) / denom_B : 0;

        // ── Historical follow-through ────────────────────────────────────
        const histLen   = Math.min(shared.length, 500);
        const histDates = shared.slice(-histLen);
        let totalSignals = 0, totalReverts = 0, laggardCaught = 0;

        for (let k = longWindow; k <= histLen - shortWindow - 1; k += shortWindow) {
          const baseDates  = histDates.slice(k - longWindow, k);
          const spreadBase = baseDates.map(d => (retA.get(d) ?? 0) - (retB.get(d) ?? 0));
          const mu_h = mean(spreadBase), std_h = std(spreadBase, mu_h);
          if (std_h === 0) continue;

          const shortWinDates  = histDates.slice(k - shortWindow, k);
          const cumSpreadShort = shortWinDates.reduce(
            (s, d) => s + (retA.get(d) ?? 0) - (retB.get(d) ?? 0), 0,
          );
          const zAtK = (cumSpreadShort - mu_h * shortWindow) / (std_h * Math.sqrt(shortWindow));
          if (Math.abs(zAtK) < 1.0) continue;
          totalSignals++;

          const nextDates     = histDates.slice(k, k + shortWindow);
          const cumSpreadNext = nextDates.reduce(
            (s, d) => s + (retA.get(d) ?? 0) - (retB.get(d) ?? 0), 0,
          );
          const reverted = (zAtK > 0 && cumSpreadNext < 0) || (zAtK < 0 && cumSpreadNext > 0);
          if (!reverted) continue;
          totalReverts++;

          const cumANext = nextDates.reduce((s, d) => s + (retA.get(d) ?? 0), 0);
          const cumBNext = nextDates.reduce((s, d) => s + (retB.get(d) ?? 0), 0);
          const aContrib = zAtK > 0 ? -cumANext :  cumANext;
          const bContrib = zAtK > 0 ?  cumBNext : -cumBNext;
          if (bContrib > aContrib) laggardCaught++;
        }

        const followRate       = totalSignals >= 3 ? totalReverts  / totalSignals : undefined;
        const laggardCatchRate = totalReverts  >  0 ? laggardCaught / totalReverts : undefined;
        const sampleCount      = totalSignals >= 3 ? totalSignals : undefined;

        divergentPairs.push({
          a: ta, b: tb,
          aLabel: assetMap.get(ta)?.label ?? ta,
          bLabel: assetMap.get(tb)?.label ?? tb,
          shortR:     parseFloat(shortR.toFixed(4)),
          longR:      parseFloat(longR.toFixed(4)),
          divergence: parseFloat(Math.abs(spreadZ).toFixed(4)),
          spreadZ:    parseFloat(spreadZ.toFixed(4)),
          cumA:       parseFloat(cumA.toFixed(6)),
          cumB:       parseFloat(cumB.toFixed(6)),
          momentumZA: parseFloat(momentumZA.toFixed(4)),
          momentumZB: parseFloat(momentumZB.toFixed(4)),
          followRate:       followRate       != null ? parseFloat(followRate.toFixed(4))       : undefined,
          laggardCatchRate: laggardCatchRate != null ? parseFloat(laggardCatchRate.toFixed(4)) : undefined,
          sampleCount,
        });
      }
    }
  }

  divergentPairs.sort((a, b) => b.divergence - a.divergence);
  const topPairs = divergentPairs.slice(0, TOP_N);

  const response: DivergenceResponse = {
    pairs: topPairs,
    timeframe,
    shortWindow,
    longWindow,
    mode,
    fetchedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKey, JSON.stringify(response), ttl);

  return NextResponse.json(response, { headers: cacheHeaders });
}
