import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { computeReturns, resampleBars, pearson } from '@/lib/correlation';
import type { Timeframe, AssetClass, DivergencePair, DivergenceResponse } from '@/types';

export const revalidate = 300;

const TOP_N = 30;
const MIN_ABS_MOVE = 0.0025;

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], mu?: number): number {
  if (arr.length < 2) return 0;
  const m = mu ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tfParam = (searchParams.get('timeframe') ?? '1h') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1h';

  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter(c => VALID_CLASSES.has(c as AssetClass)) as AssetClass[])
    : ALL_ASSET_CLASSES;

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes requested' }, { status: 400 });
  }

  const corrThreshold = Math.max(
    0,
    Math.min(1, parseFloat(searchParams.get('threshold') ?? '0.70')),
  );

  const shortWindow = Math.max(2, parseInt(searchParams.get('shortWindow') ?? '5', 10));
  const longWindow  = Math.max(shortWindow + 5, parseInt(searchParams.get('longWindow') ?? '50', 10));

  const config = TIMEFRAME_CONFIGS[timeframe];
  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);

  const { history, skipped } = await fetchPrices(tickers, config);

  // Build return maps
  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processedBars = config.resampleFactor
      ? resampleBars(bars, config.resampleFactor)
      : bars;
    const retMap = computeReturns(processedBars);
    if (retMap.size >= longWindow + shortWindow + 5) {
      returnMaps.set(ticker, retMap);
    } else {
      skipped.push(ticker);
    }
  }

  const availableTickers = tickers.filter(t => returnMaps.has(t));
  if (availableTickers.length < 2) {
    return NextResponse.json(
      { error: 'Insufficient data', skipped },
      { status: 502 },
    );
  }

  // Find shared dates across all available tickers, sorted ascending
  let sharedDates: Set<string> | null = null;
  for (const t of availableTickers) {
    const dates = new Set(returnMaps.get(t)!.keys());
    if (sharedDates === null) {
      sharedDates = dates;
    } else {
      for (const d of sharedDates) {
        if (!dates.has(d)) sharedDates.delete(d);
      }
    }
  }

  const histDates = sharedDates
    ? Array.from(sharedDates).sort()
    : [];

  if (histDates.length < longWindow + shortWindow + 3) {
    return NextResponse.json(
      { error: 'Not enough aligned history', skipped },
      { status: 502 },
    );
  }

  const assetMap = new Map(assets.map(a => [a.ticker, a]));

  const results: DivergencePair[] = [];

  for (let i = 0; i < availableTickers.length; i++) {
    for (let j = i + 1; j < availableTickers.length; j++) {
      const tA = availableTickers[i];
      const tB = availableTickers[j];

      const retA = returnMaps.get(tA)!;
      const retB = returnMaps.get(tB)!;

      // Use the tail of histDates for all calculations
      const windowDates = histDates.slice(-(longWindow + shortWindow));
      const longDates  = windowDates.slice(0, longWindow);
      const shortDates = windowDates.slice(longWindow);

      const longAVals  = longDates.map(d => retA.get(d) ?? 0);
      const longBVals  = longDates.map(d => retB.get(d) ?? 0);

      // Long-window correlation
      const longR = pearson(longAVals, longBVals);
      if (!isFinite(longR) || Math.abs(longR) < corrThreshold) continue;

      // Current-bar accumulators
      const cumA = shortDates.reduce((s, d) => s + (retA.get(d) ?? 0), 0);
      const cumB = shortDates.reduce((s, d) => s + (retB.get(d) ?? 0), 0);

      const mAmu = mean(longAVals);
      const mBmu = mean(longBVals);
      const sA   = std(longAVals, mAmu);
      const sB   = std(longBVals, mBmu);

      const denomA = sA * Math.sqrt(shortWindow);
      const denomB = sB * Math.sqrt(shortWindow);

      const momentumZA = denomA > 0 ? (cumA - mAmu * shortWindow) / denomA : 0;
      const momentumZB = denomB > 0 ? (cumB - mBmu * shortWindow) / denomB : 0;

      // Spread Z
      const spreadVals = longDates.map(
        d => (retA.get(d) ?? 0) - (retB.get(d) ?? 0),
      );
      const spreadMu  = mean(spreadVals);
      const spreadSd  = std(spreadVals, spreadMu);
      const cumSpread = cumA - cumB;
      const denomSpr  = spreadSd * Math.sqrt(shortWindow);
      const spreadZ   = denomSpr > 0
        ? (cumSpread - spreadMu * shortWindow) / denomSpr
        : 0;

      // Current-bar mover qualification
      const absMomZA = Math.abs(momentumZA);
      const absMomZB = Math.abs(momentumZB);
      const aQualified = absMomZA >= 1.0 && Math.abs(cumA) >= MIN_ABS_MOVE;
      const bQualified = absMomZB >= 1.0 && Math.abs(cumB) >= MIN_ABS_MOVE;

      const moverIsA: boolean | undefined =
        !aQualified && !bQualified ? undefined :
        aQualified && bQualified  ? absMomZA >= absMomZB : aQualified;

      // Historical qualification loop
      let totalSignals  = 0;
      let leaderConfirmed = 0;
      let totalReverts  = 0;

      const loopStart = longWindow;
      const loopEnd   = histDates.length - shortWindow;

      for (let k = loopStart; k < loopEnd; k++) {
        const lDates = histDates.slice(k - longWindow, k);
        const sDates = histDates.slice(k, k + shortWindow);

        const lAVals = lDates.map(d => retA.get(d) ?? 0);
        const lBVals = lDates.map(d => retB.get(d) ?? 0);

        const cumAk = sDates.reduce((s, d) => s + (retA.get(d) ?? 0), 0);
        const cumBk = sDates.reduce((s, d) => s + (retB.get(d) ?? 0), 0);

        const mAk  = mean(lAVals);
        const mBk  = mean(lBVals);
        const sAk  = std(lAVals, mAk);
        const sBk  = std(lBVals, mBk);
        const dA   = sAk * Math.sqrt(shortWindow);
        const dB   = sBk * Math.sqrt(shortWindow);

        const momZA = dA > 0 ? Math.abs((cumAk - mAk * shortWindow) / dA) : 0;
        const momZB = dB > 0 ? Math.abs((cumBk - mBk * shortWindow) / dB) : 0;

        const aMoves = momZA >= 1.0 && Math.abs(cumAk) >= MIN_ABS_MOVE;
        const bMoves = momZB >= 1.0 && Math.abs(cumBk) >= MIN_ABS_MOVE;

        if (!aMoves && !bMoves) continue;

        const aIsMover = aMoves && bMoves ? momZA >= momZB : aMoves;
        const holdoutMomZ = aIsMover ? momZB : momZA;
        if (holdoutMomZ > 0.5) continue;

        const moverCum = aIsMover ? cumAk : cumBk;
        totalSignals++;

        // Forward window: does holdout follow the mover's direction?
        const nextDates = histDates.slice(k + shortWindow, k + shortWindow * 2);
        if (nextDates.length > 0) {
          const holdoutNext = nextDates.reduce(
            (s, d) => s + (aIsMover ? (retB.get(d) ?? 0) : (retA.get(d) ?? 0)),
            0,
          );
          if (Math.sign(holdoutNext) === Math.sign(moverCum)) leaderConfirmed++;

          // Reversion: did the spread narrow?
          const cumANext = nextDates.reduce((s, d) => s + (retA.get(d) ?? 0), 0);
          const cumBNext = nextDates.reduce((s, d) => s + (retB.get(d) ?? 0), 0);
          if (Math.abs(cumANext - cumBNext) < Math.abs(cumAk - cumBk)) totalReverts++;
        }
      }

      const continuationRate = totalSignals >= 3 ? leaderConfirmed / totalSignals : undefined;
      const followRate       = totalSignals >= 3 ? totalReverts    / totalSignals : undefined;
      const sampleCount      = totalSignals >= 3 ? totalSignals : undefined;

      const aAsset = assetMap.get(tA);
      const bAsset = assetMap.get(tB);

      // Chart data: 20 context bars + the current short window
      const CHART_CONTEXT = 20;
      const chartDates = histDates.slice(-(CHART_CONTEXT + shortWindow));
      const recentReturnsA = chartDates.map(d => retA.get(d) ?? 0);
      const recentReturnsB = chartDates.map(d => retB.get(d) ?? 0);

      results.push({
        tickerA: tA,
        tickerB: tB,
        aLabel: aAsset?.label ?? tA,
        bLabel: bAsset?.label ?? tB,
        longR,
        cumA,
        cumB,
        momentumZA,
        momentumZB,
        spreadZ,
        moverIsA,
        continuationRate,
        followRate,
        sampleCount,
        recentReturnsA,
        recentReturnsB,
        shortWindow,
      });
    }
  }

  // Sort: qualified signals first (by |spreadZ| desc), then unqualified (by |spreadZ| desc)
  results.sort((a, b) => {
    const aHas = a.moverIsA !== undefined ? 1 : 0;
    const bHas = b.moverIsA !== undefined ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return Math.abs(b.spreadZ) - Math.abs(a.spreadZ);
  });

  const response: DivergenceResponse = {
    pairs: results.slice(0, TOP_N),
    timeframe,
    fetchedAt: new Date().toISOString(),
    skipped,
  };

  return NextResponse.json(response);
}
