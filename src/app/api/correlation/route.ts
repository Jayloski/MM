import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import {
  computeReturns,
  resampleBars,
  buildCorrelationMatrixPairwise,
  computeVolatility,
} from '@/lib/correlation';
import type { Timeframe, AssetClass, CorrelationResponse, SessionInfo } from '@/types';

export const revalidate = 300; // 5-minute ISR cache

const BARS_PER_YEAR: Record<Timeframe, number> = {
  '5m':  252 * 78,
  '15m': 252 * 26,
  '1h':  252 * 6.5,
  '4h':  252 * 6.5 / 4,
  '1d':  252,
};

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // Parse & validate timeframe
  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1d';

  // Parse & validate asset classes
  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter(c => VALID_CLASSES.has(c as AssetClass)) as AssetClass[])
    : ALL_ASSET_CLASSES;

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes requested' }, { status: 400 });
  }

  const config = TIMEFRAME_CONFIGS[timeframe];

  // Filter assets by requested classes
  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);

  // Fetch price bars
  const { history, skipped } = await fetchPrices(tickers, config);

  // Build return maps (applying resampling for 4h)
  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processedBars = config.resampleFactor
      ? resampleBars(bars, config.resampleFactor)
      : bars;
    const retMap = computeReturns(processedBars);
    if (retMap.size >= 10) {
      returnMaps.set(ticker, retMap);
    } else {
      skipped.push(ticker);
    }
  }

  // Only include tickers that have sufficient data
  const availableTickers = tickers.filter(t => returnMaps.has(t));

  if (availableTickers.length < 2) {
    return NextResponse.json(
      { error: 'Insufficient data to compute correlations', skipped },
      { status: 502 },
    );
  }

  // Build matrix using pairwise alignment (each pair finds its own shared timestamps).
  // This prevents the global intersection from collapsing when mixing assets with
  // different trading hours (e.g. US equity futures 6.5h/day vs forex 24h/day).
  const matrix = buildCorrelationMatrixPairwise(availableTickers, returnMaps, config.lookbackBars);

  // Compute annualized volatility from each ticker's own return series
  const barsPerYear = BARS_PER_YEAR[timeframe];
  const volatility: Record<string, number> = {};
  for (const ticker of availableTickers) {
    const retMap = returnMaps.get(ticker)!;
    const returns = Array.from(retMap.values()).slice(-config.lookbackBars);
    const vol = computeVolatility(returns, barsPerYear);
    if (isFinite(vol)) {
      volatility[ticker] = parseFloat(vol.toFixed(6));
    }
  }

  // Build lookup maps
  const assetMap = new Map(assets.map(a => [a.ticker, a]));
  const labels: Record<string, string> = {};
  const assetClasses: Record<string, AssetClass> = {};
  const subGroups: Record<string, string> = {};
  const sessions: Record<string, SessionInfo[]> = {};

  for (const ticker of availableTickers) {
    const asset = assetMap.get(ticker);
    if (asset) {
      labels[ticker] = asset.label;
      assetClasses[ticker] = asset.assetClass;
      subGroups[ticker] = asset.subGroup;
      sessions[ticker] = asset.sessions;
    }
  }

  const response: CorrelationResponse = {
    tickers: availableTickers,
    labels,
    assetClasses,
    subGroups: subGroups as CorrelationResponse['subGroups'],
    sessions,
    volatility,
    matrix,
    timeframe,
    fetchedAt: new Date().toISOString(),
    skipped,
  };

  return NextResponse.json(response);
}
