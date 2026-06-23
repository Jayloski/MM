import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, TIMEFRAME_CONFIGS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { computeReturns, resampleBars, alignReturns } from '@/lib/correlation';
import { computeDivergencePairs } from '@/lib/divergence';
import type { Timeframe, AssetClass, DivergenceResponse } from '@/types';

export const revalidate = 300;

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES = new Set<AssetClass>(ALL_ASSET_CLASSES);

const DEFAULT_MIN_R = 0.6;
const DEFAULT_SHORT_WINDOW = 10;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1d';

  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter(c => VALID_CLASSES.has(c as AssetClass)) as AssetClass[])
    : ALL_ASSET_CLASSES;

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes' }, { status: 400 });
  }

  const minR = Math.min(
    Math.max(parseFloat(searchParams.get('minR') ?? String(DEFAULT_MIN_R)), 0.1),
    0.99,
  );
  const shortWindow = Math.min(
    Math.max(parseInt(searchParams.get('shortWindow') ?? String(DEFAULT_SHORT_WINDOW), 10), 3),
    50,
  );

  const config = TIMEFRAME_CONFIGS[timeframe];
  const assets = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers = assets.map(a => a.ticker);

  const { history, skipped } = await fetchPrices(tickers, config);

  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processedBars = config.resampleFactor
      ? resampleBars(bars, config.resampleFactor)
      : bars;
    const retMap = computeReturns(processedBars);
    if (retMap.size >= shortWindow + 10) {
      returnMaps.set(ticker, retMap);
    } else {
      skipped.push(ticker);
    }
  }

  const availableTickers = tickers.filter(t => returnMaps.has(t));
  if (availableTickers.length < 2) {
    return NextResponse.json({ error: 'Insufficient data', skipped }, { status: 502 });
  }

  const aligned = alignReturns(returnMaps, config.lookbackBars);
  const assetMap = new Map(assets.map(a => [a.ticker, { label: a.label, assetClass: a.assetClass }]));

  const pairs = computeDivergencePairs(aligned, availableTickers, assetMap, shortWindow, minR);

  const response: DivergenceResponse = {
    pairs,
    timeframe,
    fetchedAt: new Date().toISOString(),
    skipped,
    shortWindow,
  };

  return NextResponse.json(response);
}
