import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { cacheGet, cacheSet } from '@/lib/cache';
import { computeReturns, resampleBars, pearson } from '@/lib/correlation';
import type { Timeframe, AssetClass, DivergencePair, DivergenceResponse } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

// Default window sizes (in bars)
const DEFAULT_SHORT = 20;
const DEFAULT_LONG  = 60;

// Only return the top N most divergent pairs to keep the response lean
const TOP_N = 30;

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

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes requested' }, { status: 400 });
  }

  const config = TIMEFRAME_CONFIGS[timeframe];
  const ttl = config.cacheTtlSeconds;
  const cacheHeaders = {
    'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
  };

  const cacheKey = `div:${timeframe}:${shortWindow}:${longWindow}:${[...requestedClasses].sort().join(',')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), { headers: cacheHeaders });
  }

  // Fetch enough history to compute the long window
  const extraFactor = Math.ceil((longWindow * 2) / config.lookbackBars) + 1;
  const histConfig = { ...config, fetchDays: config.fetchDays * extraFactor };

  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);
  const assetMap = new Map(assets.map(a => [a.ticker, a]));

  const { history, skipped } = await fetchPrices(tickers, histConfig);

  // Build return series per ticker
  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    if (skipped.includes(ticker)) continue;
    const processed = config.resampleFactor ? resampleBars(bars, config.resampleFactor) : bars;
    const retMap = computeReturns(processed);
    if (retMap.size >= longWindow + 1) {
      returnMaps.set(ticker, retMap);
    }
  }

  const available = Array.from(returnMaps.keys());
  if (available.length < 2) {
    return NextResponse.json({ error: 'Insufficient data for divergence scan' }, { status: 502 });
  }

  // For each pair, compute short-window and long-window correlations
  const divergentPairs: DivergencePair[] = [];

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const ta = available[i];
      const tb = available[j];
      const retA = returnMaps.get(ta)!;
      const retB = returnMaps.get(tb)!;

      const shared = Array.from(retA.keys()).filter(d => retB.has(d)).sort();
      if (shared.length < longWindow + 1) continue;

      // Most-recent longWindow dates
      const longDates  = shared.slice(-longWindow);
      const shortDates = shared.slice(-shortWindow);

      const arrLongA  = longDates.map(d => retA.get(d)!);
      const arrLongB  = longDates.map(d => retB.get(d)!);
      const arrShortA = shortDates.map(d => retA.get(d)!);
      const arrShortB = shortDates.map(d => retB.get(d)!);

      const longR  = pearson(arrLongA,  arrLongB);
      const shortR = pearson(arrShortA, arrShortB);

      if (!isFinite(longR) || !isFinite(shortR)) continue;

      const divergence = Math.abs(shortR - longR);

      divergentPairs.push({
        a: ta,
        b: tb,
        aLabel: assetMap.get(ta)?.label ?? ta,
        bLabel: assetMap.get(tb)?.label ?? tb,
        shortR:     parseFloat(shortR.toFixed(4)),
        longR:      parseFloat(longR.toFixed(4)),
        divergence: parseFloat(divergence.toFixed(4)),
      });
    }
  }

  // Sort by divergence desc, take top N
  divergentPairs.sort((a, b) => b.divergence - a.divergence);
  const topPairs = divergentPairs.slice(0, TOP_N);

  const response: DivergenceResponse = {
    pairs: topPairs,
    timeframe,
    shortWindow,
    longWindow,
    fetchedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKey, JSON.stringify(response), ttl);

  return NextResponse.json(response, { headers: cacheHeaders });
}
