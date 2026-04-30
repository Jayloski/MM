import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const revalidate = 0;

export async function GET() {
  const ticker = 'ES=F';
  const period2 = new Date();
  const period1 = new Date();
  period1.setDate(period1.getDate() - 7);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (yahooFinance.chart as any)(
      ticker,
      { period1, period2, interval: '60m' },
      { validateResult: false },
    );
    const quotes = result?.quotes ?? [];
    return NextResponse.json({
      ok: true,
      ticker,
      quoteCount: quotes.length,
      first: quotes[0] ?? null,
      last: quotes[quotes.length - 1] ?? null,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ticker,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5) : undefined,
    });
  }
}
