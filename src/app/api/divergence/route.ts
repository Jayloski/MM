import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { cacheGet, cacheSet } from '@/lib/cache';
import { computeReturns, resampleBars, alignReturns } from '@/lib/correlation';
import { scanDivergences, DEFAULT_DIVERGENCE_PARAMS } from '@/lib/divergence';
import type { Timeframe, AssetClass, DivergenceResponse } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1d';

  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter((c): c is AssetClass => VALID_CLASSES.has(c as AssetClass)))
    : ALL_ASSET_CLASSES;

  const config = TIMEFRAME_CONFIGS[timeframe];
  const params = { ...DEFAULT_DIVERGENCE_PARAMS };

  // Scale forwardBars to timeframe so "10 bars" is meaningful across timeframes
  if (timeframe === '5m' || timeframe === '15m') params.forwardBars = 6;
  else if (timeframe === '1h') params.forwardBars = 8;

  const cacheKey = `div:${timeframe}:${[...requestedClasses].sort().join(',')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached));
  }

  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);

  const { history, skipped } = await fetchPrices(tickers, config);
  console.log(`[divergence] skipped: ${skipped.join(', ') || 'none'}`);

  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processed = config.resampleFactor ? resampleBars(bars, config.resampleFactor) : bars;
    const retMap = computeReturns(processed);
    if (retMap.size >= params.shortWindow * 3 + params.forwardBars) {
      returnMaps.set(ticker, retMap);
    }
  }

  const availableTickers = tickers.filter(t => returnMaps.has(t));
  if (availableTickers.length < 2) {
    return NextResponse.json({ pairs: [], timeframe, shortWindow: params.shortWindow, forwardBars: params.forwardBars, fetchedAt: new Date().toISOString() });
  }

  // Use a larger lookback for divergence so we have good probability estimates
  const lookback = Math.min(config.lookbackBars * 2, 500);
  const aligned = alignReturns(returnMaps, lookback);

  // Build correlation matrix subset for available tickers
  const n = availableTickers.length;
  const matrix: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(n).fill(null));
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1;
    const aRet = aligned.get(availableTickers[i]) ?? [];
    for (let j = i + 1; j < n; j++) {
      const bRet = aligned.get(availableTickers[j]) ?? [];
      const len = Math.min(aRet.length, bRet.length);
      if (len < 10) continue;
      const a = aRet.slice(-len);
      const b = bRet.slice(-len);
      let sumA = 0, sumB = 0;
      for (let k = 0; k < len; k++) { sumA += a[k]; sumB += b[k]; }
      const mA = sumA / len, mB = sumB / len;
      let num = 0, dA = 0, dB = 0;
      for (let k = 0; k < len; k++) {
        const da = a[k] - mA, db = b[k] - mB;
        num += da * db; dA += da * da; dB += db * db;
      }
      const denom = Math.sqrt(dA * dB);
      const r = denom === 0 ? null : parseFloat((num / denom).toFixed(4));
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }

  const assetMap = new Map(assets.map(a => [a.ticker, a]));
  const labels: Record<string, string> = {};
  const assetClasses: Record<string, string> = {};
  const subGroups: Record<string, string> = {};
  for (const ticker of availableTickers) {
    const asset = assetMap.get(ticker);
    if (asset) {
      labels[ticker]      = asset.label;
      assetClasses[ticker] = asset.assetClass;
      subGroups[ticker]   = asset.subGroup;
    }
  }

  const pairs = scanDivergences(
    availableTickers, labels, assetClasses, subGroups, matrix, aligned, params,
  );

  const response: DivergenceResponse = {
    pairs,
    timeframe,
    shortWindow: params.shortWindow,
    forwardBars: params.forwardBars,
    fetchedAt: new Date().toISOString(),
  };

  // Cache with same TTL as correlation but halved (divergence signals are more time-sensitive)
  await cacheSet(cacheKey, JSON.stringify(response), Math.floor(config.cacheTtlSeconds / 2));

  return NextResponse.json(response);
}
