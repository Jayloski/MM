import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const tickers = ['ES=F', 'NQ=F', 'GC=F'];
  const results: Record<string, unknown> = {};

  const mod = await import('yahoo-finance2');
  const yahooFinance = mod.default;

  for (const ticker of tickers) {
    const period2 = new Date();
    const period1 = new Date();
    period1.setDate(period1.getDate() - 7);

    try {
      const result = await yahooFinance.chart(ticker, {
        period1,
        period2,
        interval: '60m',
      });
      const quotes = result?.quotes ?? [];
      results[ticker] = {
        ok: true,
        quoteCount: quotes.length,
        firstDate: quotes[0]?.date ?? null,
        lastDate: quotes[quotes.length - 1]?.date ?? null,
        firstClose: quotes[0]?.close ?? null,
      };
    } catch (err) {
      results[ticker] = {
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      };
    }
  }

  return NextResponse.json(results);
}
