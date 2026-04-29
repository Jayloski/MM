import { NextResponse } from 'next/server';
import { TIMEFRAME_CONFIGS } from '@/lib/assets';
import { fetchPrices } from '@/lib/fetchPrices';
import { computeReturns, pearson } from '@/lib/correlation';

export const dynamic = 'force-dynamic';

// Hit /api/debug to see exactly what YF returns for ES=F vs NQ=F
export async function GET() {
  const config = TIMEFRAME_CONFIGS['1d'];
  const tickers = ['ES=F', 'NQ=F'];

  const { history, skipped } = await fetchPrices(tickers, config);

  const detail: Record<string, unknown> = { skipped };

  for (const ticker of tickers) {
    const bars = history[ticker];
    if (!bars) {
      detail[ticker] = { status: 'skipped — no bars returned' };
      continue;
    }
    const retMap = computeReturns(bars);
    detail[ticker] = {
      bars: bars.length,
      firstBar: bars[0],
      lastBar:  bars[bars.length - 1],
      returns:  retMap.size,
      firstReturnDate: Array.from(retMap.keys())[0],
      lastReturnDate:  Array.from(retMap.keys()).at(-1),
    };
  }

  // Pairwise correlation
  const retA = history['ES=F'] ? computeReturns(history['ES=F']) : null;
  const retB = history['NQ=F'] ? computeReturns(history['NQ=F']) : null;

  let pairInfo: Record<string, unknown> = { status: 'could not compute — missing data' };
  if (retA && retB) {
    const shared = Array.from(retA.keys()).filter(d => retB.has(d)).sort();
    const shortShared = shared.slice(-config.lookbackBars);
    const r = shortShared.length >= 2
      ? pearson(shortShared.map(d => retA.get(d)!), shortShared.map(d => retB.get(d)!))
      : NaN;
    pairInfo = {
      sharedDates:       shared.length,
      lookbackUsed:      shortShared.length,
      firstSharedDate:   shared[0],
      lastSharedDate:    shared.at(-1),
      pearsonR:          isFinite(r) ? r : 'NaN',
    };
  }

  return NextResponse.json({
    timeframe: '1d',
    config: { lookbackBars: config.lookbackBars, fetchDays: config.fetchDays },
    tickers: detail,
    pair_ES_NQ: pairInfo,
  });
}
