import { NextResponse } from 'next/server';

export const revalidate = 0;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test 1: can we reach anything at all?
  try {
    const r = await fetch('https://httpbin.org/get', { headers: { 'User-Agent': 'test' } });
    results.httpbin = { status: r.status };
  } catch (e: unknown) {
    const err = e as Error & { cause?: unknown };
    results.httpbin = { error: err.message, cause: String(err.cause ?? '') };
  }

  // Test 2: Yahoo Finance homepage
  try {
    const r = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    results.yahoo = { status: r.status };
  } catch (e: unknown) {
    const err = e as Error & { cause?: unknown };
    results.yahoo = { error: err.message, cause: String(err.cause ?? '') };
  }

  // Test 3: Yahoo Finance query API directly (no auth)
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?interval=1d&range=5d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const text = await r.text();
    results.yahooQuery = { status: r.status, bodySnippet: text.slice(0, 150) };
  } catch (e: unknown) {
    const err = e as Error & { cause?: unknown };
    results.yahooQuery = { error: err.message, cause: String(err.cause ?? '') };
  }

  return NextResponse.json(results);
}
