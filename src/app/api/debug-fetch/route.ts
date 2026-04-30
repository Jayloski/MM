import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const ticker = 'ES=F';
  const period2 = new Date();
  const period1 = new Date();
  period1.setDate(period1.getDate() - 7);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const yf = require('yahoo-finance2');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yahooFinance: any = yf.default ?? yf;

    yahooFinance.suppressNotices?.(['yahooSurvey', 'ripHistorical']);

    const result = await yahooFinance.chart(
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
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 6) : undefined,
    });
  }
}
