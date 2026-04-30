import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const revalidate = 0;

export async function GET() {
  const period2 = new Date();
  const period1 = new Date();
  period1.setDate(period1.getDate() - 7);

  try {
    const result = await yahooFinance.chart('ES=F', {
      period1,
      period2,
      interval: '60m',
    });
    const quotes = result?.quotes ?? [];
    return NextResponse.json({
      ok: true,
      quoteCount: quotes.length,
      firstClose: quotes[0]?.close ?? null,
      lastClose: quotes[quotes.length - 1]?.close ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 300) : String(err),
    });
  }
}
