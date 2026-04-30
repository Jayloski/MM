import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const mod = await import('yahoo-finance2');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mod as any;

  const YF = m.default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instance = new YF() as any;

  const shape = {
    protoChart: typeof YF.prototype?.chart,
    instanceChart: typeof instance.chart,
  };

  if (typeof instance.chart !== 'function') {
    return NextResponse.json({ ...shape, error: 'chart still not a function' });
  }

  // Try a real fetch
  const period2 = new Date();
  const period1 = new Date();
  period1.setDate(period1.getDate() - 7);
  try {
    const result = await instance.chart('ES=F', { period1, period2, interval: '60m' });
    const quotes = result?.quotes ?? [];
    return NextResponse.json({ ...shape, ok: true, quoteCount: quotes.length });
  } catch (err) {
    return NextResponse.json({ ...shape, ok: false, error: err instanceof Error ? err.message.slice(0, 300) : String(err) });
  }
}
