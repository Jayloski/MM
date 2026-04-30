import { NextResponse } from 'next/server';
import { fetchYahooChart } from '@/lib/yahooApi';

export const revalidate = 0;

export async function GET() {
  try {
    const bars = await fetchYahooChart('ES=F', '60m', 7);
    return NextResponse.json({
      ok: bars !== null,
      quoteCount: bars?.length ?? 0,
      first: bars?.[0] ?? null,
      last: bars?.[bars.length - 1] ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err),
    });
  }
}
