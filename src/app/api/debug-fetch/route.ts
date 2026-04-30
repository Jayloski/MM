import { NextResponse } from 'next/server';

export const revalidate = 0;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET() {
  const results: Record<string, unknown> = {};

  for (const { interval, range } of [
    { interval: '5m',  range: '7d'  },
    { interval: '15m', range: '14d' },
    { interval: '60m', range: '7d'  },
  ]) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/ES%3DF?interval=${interval}&range=${range}&includePrePost=false`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
      const json = await res.json();
      const result = json?.chart?.result?.[0];
      const quotes = result?.timestamp ?? [];
      const closes = result?.indicators?.quote?.[0]?.close ?? [];
      const nonNull = closes.filter((c: unknown) => c != null).length;
      results[interval] = {
        status: res.status,
        timestamps: quotes.length,
        closes: closes.length,
        nonNullCloses: nonNull,
        error: json?.chart?.error ?? null,
        firstTs: quotes[0] ? new Date(quotes[0] * 1000).toISOString() : null,
        lastTs: quotes.at(-1) ? new Date(quotes.at(-1) * 1000).toISOString() : null,
      };
    } catch (e: unknown) {
      results[interval] = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return NextResponse.json(results);
}
