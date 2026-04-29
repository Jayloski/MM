import { NextRequest, NextResponse } from 'next/server';
import { ASSETS, ALL_ASSET_CLASSES } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import {
  computeReturns,
  resampleBars,
  alignReturns,
  computeDivergenceRow,
} from '@/lib/correlation';
import type { Timeframe, AssetClass, DivergenceResponse } from '@/types';

export const revalidate = 300;

const BASE_BARS   = 60;
const MOM_BARS    = 20;
const SCAN_STEP   = 5;
const CORR_MIN    = 0.60;
const SPREAD_Z_MIN = 0.75;

const VALID_TIMEFRAMES = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);
const VALID_CLASSES   = new Set<AssetClass>(ALL_ASSET_CLASSES);

// Minimal fetch configs — only need enough bars for BASE_BARS aligned returns
const DIV_FETCH: Record<Timeframe, { yfInterval: '5m'|'15m'|'60m'|'1d'; resampleFactor?: number; fetchDays: number }> = {
  '5m':  { yfInterval: '5m',  fetchDays: 5   },
  '15m': { yfInterval: '15m', fetchDays: 10  },
  '1h':  { yfInterval: '60m', fetchDays: 20  },
  '4h':  { yfInterval: '60m', resampleFactor: 4, fetchDays: 60 },
  '1d':  { yfInterval: '1d',  fetchDays: 120 },
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TIMEFRAMES.has(tfParam) ? tfParam : '1d';

  const classParam = searchParams.get('classes');
  const requestedClasses: AssetClass[] = classParam
    ? (classParam.split(',').filter((c): c is AssetClass => VALID_CLASSES.has(c as AssetClass)))
    : ALL_ASSET_CLASSES;

  if (requestedClasses.length === 0) {
    return NextResponse.json({ error: 'No valid asset classes requested' }, { status: 400 });
  }

  const fetchCfg = DIV_FETCH[timeframe];
  const assets   = ASSETS.filter(a => requestedClasses.includes(a.assetClass));
  const tickers  = assets.map(a => a.ticker);

  const { history, skipped } = await fetchPrices(tickers, {
    ...fetchCfg,
    lookbackBars: BASE_BARS + 10,
    label: `div-${timeframe}`,
  });

  // Build return maps
  const returnMaps = new Map<string, Map<string, number>>();
  for (const [ticker, bars] of Object.entries(history)) {
    const processed = fetchCfg.resampleFactor ? resampleBars(bars, fetchCfg.resampleFactor) : bars;
    const retMap    = computeReturns(processed);
    if (retMap.size >= BASE_BARS) {
      returnMaps.set(ticker, retMap);
    } else {
      skipped.push(ticker);
    }
  }

  const available = tickers.filter(t => returnMaps.has(t));
  if (available.length < 2) {
    return NextResponse.json({ error: 'Insufficient data', skipped }, { status: 502 });
  }

  // Align — take the last BASE_BARS of shared dates
  const aligned = alignReturns(returnMaps, BASE_BARS);

  const assetMap = new Map(assets.map(a => [a.ticker, a]));
  const rows = [];

  for (let i = 0; i < available.length; i++) {
    for (let j = i + 1; j < available.length; j++) {
      const tA = available[i];
      const tB = available[j];
      const rA = aligned.get(tA);
      const rB = aligned.get(tB);
      if (!rA || !rB) continue;

      const lA = assetMap.get(tA)?.label ?? tA;
      const lB = assetMap.get(tB)?.label ?? tB;

      const row = computeDivergenceRow(
        tA, tB, lA, lB, rA, rB,
        BASE_BARS, MOM_BARS, SCAN_STEP, CORR_MIN, SPREAD_Z_MIN,
      );
      if (row) rows.push(row);
    }
  }

  // Sort by |spreadZ| descending
  rows.sort((a, b) => Math.abs(b.spreadZ) - Math.abs(a.spreadZ));

  const response: DivergenceResponse = {
    rows,
    baseBars: BASE_BARS,
    momBars:  MOM_BARS,
    corrThreshold: CORR_MIN,
    timeframe,
    fetchedAt: new Date().toISOString(),
    skipped,
  };

  return NextResponse.json(response);
}
