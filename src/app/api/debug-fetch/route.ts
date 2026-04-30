import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const mod = await import('yahoo-finance2');

  // Inspect the module shape
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = mod as any;
  const shape = {
    modKeys: Object.keys(m),
    defaultType: typeof m.default,
    defaultKeys: m.default ? Object.keys(m.default).slice(0, 20) : null,
    defaultDefaultType: typeof m.default?.default,
    defaultDefaultKeys: m.default?.default ? Object.keys(m.default.default).slice(0, 20) : null,
    hasChart: typeof m.chart,
    defaultHasChart: typeof m.default?.chart,
    defaultDefaultHasChart: typeof m.default?.default?.chart,
  };

  return NextResponse.json(shape);
}
