import { NextRequest, NextResponse } from 'next/server';
import { TIMEFRAME_CONFIGS } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { computeReturns, resampleBars, filterSessionBars, pearson } from '@/lib/correlation';
import { cacheGet, cacheSet } from '@/lib/cache';
import type { Timeframe, HistoryResponse } from '@/types';

export const dynamic = 'force-dynamic';


const VALID_TF = new Set<Timeframe>(['5m', '15m', '1h', '4h', '1d']);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const a = searchParams.get('a');
  const b = searchParams.get('b');
  const tfParam = (searchParams.get('timeframe') ?? '1d') as Timeframe;
  const timeframe: Timeframe = VALID_TF.has(tfParam) ? tfParam : '1d';

  if (!a || !b) {
    return NextResponse.json({ error: 'Missing a or b parameter' }, { status: 400 });
  }

  // ── Redis cache check ────────────────────────────────────────────────────
  const base = TIMEFRAME_CONFIGS[timeframe];
  const WINDOW_BARS = base.historyWindowBars;
  const ttl = base.cacheTtlSeconds;
  const cacheKey = `hist:${timeframe}:${[a, b].sort().join(':')}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(JSON.parse(cached), {
      headers: { 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}` },
    });
  }

  // Fetch 4× the normal window so we get a meaningful rolling series
  const histConfig = { ...base, fetchDays: base.fetchDays * 4 };
  const { history } = await fetchPrices([a, b], histConfig);

  const rawA = history[a];
  const rawB = history[b];

  if (!rawA?.length || !rawB?.length) {
    return NextResponse.json(
      { error: 'Insufficient price data for one or both tickers' },
      { status: 502 },
    );
  }

  const applySession = (bars: typeof rawA) => {
    const resampled = base.resampleFactor ? resampleBars(bars, base.resampleFactor) : bars;
    return base.sessionFilter ? filterSessionBars(resampled, base.sessionFilter) : resampled;
  };

  const retA = computeReturns(applySession(rawA));
  const retB = computeReturns(applySession(rawB));

  // Align to intersection of dates
  const sharedDates = Array.from(retA.keys())
    .filter(d => retB.has(d))
    .sort();

  if (sharedDates.length < WINDOW_BARS + 1) {
    return NextResponse.json(
      { error: `Not enough shared bars (${sharedDates.length}) for a ${WINDOW_BARS}-bar rolling window` },
      { status: 502 },
    );
  }

  // Slide the window
  const points: HistoryResponse['points'] = [];
  for (let end = WINDOW_BARS; end <= sharedDates.length; end++) {
    const window = sharedDates.slice(end - WINDOW_BARS, end);
    const arrA = window.map(d => retA.get(d)!);
    const arrB = window.map(d => retB.get(d)!);
    const r = pearson(arrA, arrB);
    if (isFinite(r)) {
      points.push({ date: sharedDates[end - 1], r: parseFloat(r.toFixed(4)) });
    }
  }

  const response: HistoryResponse = { a, b, timeframe, points, windowBars: WINDOW_BARS };

  await cacheSet(cacheKey, JSON.stringify(response), ttl);

  return NextResponse.json(response, {
    headers: { 'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}` },
  });
}
