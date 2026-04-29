import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { computeReturns, resampleBars, pearson } from '@/lib/correlation';
import type { Timeframe, AssetClass, DivergencePair, DivergenceResponse } from '@/types';

export const revalidate = 300;

const TOP_N = 50;
const MIN_ABS_MOVE = 0.0025;

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

function arrayMean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function arrayStd(arr: number[], mu: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / arr.length);
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
    return NextResponse.json({ error: 'No valid asset classes' }, { status: 400 });
  }

  const shortWindow = Math.max(5, Math.min(50, parseInt(searchParams.get('shortWindow') ?? '20', 10) || 20));
  const longWindow  = Math.max(20, Math.min(200, parseInt(searchParams.get('longWindow')  ?? '60', 10) || 60));
  const minLongR    = parseFloat(searchParams.get('minLongR') ?? '0.35');

  const config = TIMEFRAME_CONFIGS[timeframe];
  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);

  const { history, skipped } = await fetchPrices(tickers, config);

  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processedBars = config.resampleFactor ? resampleBars(bars, config.resampleFactor) : bars;
    const retMap = computeReturns(processedBars);
    if (retMap.size >= longWindow + shortWindow * 2) {
      returnMaps.set(ticker, retMap);
    } else {
      skipped.push(ticker);
    }
  }

  const availableTickers = tickers.filter(t => returnMaps.has(t));
  const assetMap = new Map(assets.map(a => [a.ticker, a]));
  const pairs: DivergencePair[] = [];

  for (let i = 0; i < availableTickers.length; i++) {
    for (let j = i + 1; j < availableTickers.length; j++) {
      const tA = availableTickers[i];
      const tB = availableTickers[j];
      const retA = returnMaps.get(tA)!;
      const retB = returnMaps.get(tB)!;

      // Shared sorted dates
      const datesA = new Set(retA.keys());
      const allDates = Array.from(retB.keys()).filter(d => datesA.has(d)).sort();
      if (allDates.length < longWindow + shortWindow * 2) continue;

      // Build return arrays and prefix sums for O(1) window sums
      const arrA = allDates.map(d => retA.get(d)!);
      const arrB = allDates.map(d => retB.get(d)!);
      const prefA = new Float64Array(allDates.length + 1);
      const prefB = new Float64Array(allDates.length + 1);
      for (let k = 0; k < allDates.length; k++) {
        prefA[k + 1] = prefA[k] + arrA[k];
        prefB[k + 1] = prefB[k] + arrB[k];
      }
      const winSum = (pref: Float64Array, start: number, len: number) =>
        pref[start + len] - pref[start];

      const N = allDates.length;

      // Baseline window: the longWindow bars just before the current shortWindow
      const longStart  = N - longWindow - shortWindow;
      const shortStart = N - shortWindow;

      const longArrA = arrA.slice(longStart, longStart + longWindow);
      const longArrB = arrB.slice(longStart, longStart + longWindow);

      const mAmu  = arrayMean(longArrA);
      const mBmu  = arrayMean(longArrB);
      const mAstd = arrayStd(longArrA, mAmu);
      const mBstd = arrayStd(longArrB, mBmu);
      const denomA = mAstd * Math.sqrt(shortWindow);
      const denomB = mBstd * Math.sqrt(shortWindow);

      // Long-window correlation gate
      const longR = pearson(longArrA, longArrB);
      if (!isFinite(longR) || Math.abs(longR) < minLongR) continue;

      // Current short-window cumulative returns
      const cumA = winSum(prefA, shortStart, shortWindow);
      const cumB = winSum(prefB, shortStart, shortWindow);

      // Signed momentum Z (direction display)
      const momentumZA = denomA > 0 ? (cumA - mAmu * shortWindow) / denomA : 0;
      const momentumZB = denomB > 0 ? (cumB - mBmu * shortWindow) / denomB : 0;

      // Spread Z — z-score of current spread vs rolling spread distribution over longWindow
      const spreadSamples: number[] = [];
      for (let k = longStart; k <= longStart + longWindow - shortWindow; k++) {
        spreadSamples.push(winSum(prefA, k, shortWindow) - winSum(prefB, k, shortWindow));
      }
      const spreadMu    = arrayMean(spreadSamples);
      const spreadSigma = arrayStd(spreadSamples, spreadMu);
      const spreadZ = spreadSigma > 0 ? ((cumA - cumB) - spreadMu) / spreadSigma : 0;

      // Current-bar mover qualification (abs momZ + raw move both gates)
      const absMomZA = Math.abs(momentumZA);
      const absMomZB = Math.abs(momentumZB);
      const aQualified = absMomZA >= 1.0 && Math.abs(cumA) >= MIN_ABS_MOVE;
      const bQualified = absMomZB >= 1.0 && Math.abs(cumB) >= MIN_ABS_MOVE;
      const moverIsA: boolean | undefined =
        !aQualified && !bQualified ? undefined :
        aQualified && bQualified   ? absMomZA >= absMomZB : aQualified;

      // Historical qualification loop — fixed baseline stats, prefix-sum O(1) window sums
      let totalSignals = 0;
      let leaderConfirmed = 0;
      let totalReverts = 0;

      const histEnd = N - shortWindow * 2;
      for (let k = 0; k <= histEnd; k++) {
        const cumAk = winSum(prefA, k, shortWindow);
        const cumBk = winSum(prefB, k, shortWindow);

        const hMomZA = denomA > 0 ? Math.abs((cumAk - mAmu * shortWindow) / denomA) : 0;
        const hMomZB = denomB > 0 ? Math.abs((cumBk - mBmu * shortWindow) / denomB) : 0;

        const hAMoves = hMomZA >= 1.0 && Math.abs(cumAk) >= MIN_ABS_MOVE;
        const hBMoves = hMomZB >= 1.0 && Math.abs(cumBk) >= MIN_ABS_MOVE;
        if (!hAMoves && !hBMoves) continue;

        const hAIsMover   = hAMoves && hBMoves ? hMomZA >= hMomZB : hAMoves;
        const moverCum    = hAIsMover ? cumAk : cumBk;
        const holdoutMomZ = hAIsMover ? hMomZB : hMomZA;
        if (holdoutMomZ > 0.5) continue;
        totalSignals++;

        const holdoutNext = winSum(hAIsMover ? prefB : prefA, k + shortWindow, shortWindow);
        if (Math.sign(holdoutNext) === Math.sign(moverCum)) leaderConfirmed++;

        const cumANext = winSum(prefA, k + shortWindow, shortWindow);
        const cumBNext = winSum(prefB, k + shortWindow, shortWindow);
        if (Math.abs(cumANext - cumBNext) < Math.abs(cumAk - cumBk)) totalReverts++;
      }

      const continuationRate = totalSignals >= 3 ? leaderConfirmed / totalSignals : undefined;
      const followRate       = totalSignals >= 3 ? totalReverts    / totalSignals : undefined;
      const sampleCount      = totalSignals >= 3 ? totalSignals    : undefined;

      pairs.push({
        aLabel: assetMap.get(tA)?.label ?? tA,
        bLabel: assetMap.get(tB)?.label ?? tB,
        longR:      parseFloat(longR.toFixed(3)),
        cumA:       parseFloat(cumA.toFixed(4)),
        cumB:       parseFloat(cumB.toFixed(4)),
        momentumZA: parseFloat(momentumZA.toFixed(2)),
        momentumZB: parseFloat(momentumZB.toFixed(2)),
        spreadZ:    parseFloat(spreadZ.toFixed(2)),
        moverIsA,
        continuationRate: continuationRate != null ? parseFloat(continuationRate.toFixed(3)) : undefined,
        followRate:       followRate        != null ? parseFloat(followRate.toFixed(3))       : undefined,
        sampleCount,
      });
    }
  }

  pairs.sort((a, b) => Math.abs(b.spreadZ) - Math.abs(a.spreadZ));

  const response: DivergenceResponse = {
    pairs: pairs.slice(0, TOP_N),
    shortWindow,
    longWindow,
    timeframe,
    classes: requestedClasses,
    minLongR,
    fetchedAt: new Date().toISOString(),
    skipped,
  };

  return NextResponse.json(response);
}
