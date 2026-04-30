import { NextResponse } from 'next/server';
import { fetchYahooChart } from '@/lib/yahooApi';

export const revalidate = 0;

export async function GET() {
  const tickers = ['ES=F', 'NQ=F', 'GC=F'];
  const results: Record<string, unknown> = {};

  for (const t of tickers) {
    try {
      const bars = await fetchYahooChart(t, '60m', 7);
      results[t] = { ok: bars !== null, count: bars?.length ?? 0, last: bars?.at(-1) ?? null };
    } catch (e: unknown) {
      const err = e as Error & { cause?: unknown };
      results[t] = { error: err.message, cause: String(err.cause ?? '') };
    }
  }

  return NextResponse.json(results);
}
