import { NextResponse } from 'next/server';
import { fetchYahooChart } from '@/lib/yahooApi';
import { computeReturns } from '@/lib/correlation';

export const revalidate = 0;

// Test pairwise intersection between two tickers at 5m
export async function GET() {
  const tickerA = 'ES=F';
  const tickerB = 'EURUSD=X';

  const [barsA, barsB] = await Promise.all([
    fetchYahooChart(tickerA, '5m', 7),
    fetchYahooChart(tickerB, '5m', 7),
  ]);

  if (!barsA || !barsB) {
    return NextResponse.json({ error: 'fetch failed', barsA: !!barsA, barsB: !!barsB });
  }

  const mapA = computeReturns(barsA);
  const mapB = computeReturns(barsB);

  const datesA = new Set(mapA.keys());
  const pairDates = Array.from(mapB.keys()).filter(d => datesA.has(d)).sort();

  return NextResponse.json({
    barsA: barsA.length,
    barsB: barsB.length,
    mapASize: mapA.size,
    mapBSize: mapB.size,
    pairDatesCount: pairDates.length,
    firstA: barsA[0]?.date,
    lastA: barsA.at(-1)?.date,
    firstB: barsB[0]?.date,
    lastB: barsB.at(-1)?.date,
    firstPairDate: pairDates[0],
    lastPairDate: pairDates.at(-1),
    sampleA: Array.from(mapA.keys()).slice(0, 3),
    sampleB: Array.from(mapB.keys()).slice(0, 3),
  });
}
