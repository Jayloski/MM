import { NextResponse } from 'next/server';

export const revalidate = 0;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function GET() {
  const steps: Record<string, unknown> = {};

  // Step 1: hit Yahoo Finance homepage
  try {
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    const cookie = homeRes.headers.get('set-cookie') ?? '';
    steps.home = { status: homeRes.status, cookieLen: cookie.length, cookieSnippet: cookie.slice(0, 80) };

    // Step 2: get crumb
    try {
      const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': UA, Cookie: cookie },
      });
      const crumbText = await crumbRes.text();
      steps.crumb = { status: crumbRes.status, crumb: crumbText.slice(0, 50) };

      // Step 3: fetch chart
      if (crumbRes.ok && crumbText && !crumbText.includes('<')) {
        const period2 = Math.floor(Date.now() / 1000);
        const period1 = period2 - 7 * 24 * 3600;
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/ES%3DF?interval=60m&period1=${period1}&period2=${period2}&crumb=${encodeURIComponent(crumbText.trim())}`;
        const chartRes = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie } });
        const body = await chartRes.text();
        steps.chart = { status: chartRes.status, bodySnippet: body.slice(0, 200) };
      }
    } catch (e) {
      steps.crumbError = e instanceof Error ? e.message : String(e);
    }
  } catch (e) {
    steps.homeError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(steps);
}
