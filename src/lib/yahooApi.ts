import 'server-only';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface Auth {
  crumb: string;
  cookie: string;
  expiresAt: number;
}

let _auth: Auth | null = null;

async function refreshAuth(): Promise<Auth | null> {
  try {
    const homeRes = await fetch('https://finance.yahoo.com/', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    const cookie = homeRes.headers.get('set-cookie') ?? '';

    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: { 'User-Agent': UA, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;

    const crumb = (await crumbRes.text()).trim();
    if (!crumb || crumb.includes('<') || crumb.length > 100) return null;

    return { crumb, cookie, expiresAt: Date.now() + 50 * 60 * 1000 };
  } catch {
    return null;
  }
}

async function getAuth(): Promise<Auth | null> {
  if (_auth && _auth.expiresAt > Date.now()) return _auth;
  _auth = await refreshAuth();
  return _auth;
}

export interface YahooBar {
  date: string;
  close: number;
}

export async function fetchYahooChart(
  symbol: string,
  interval: '5m' | '15m' | '60m' | '1d',
  fetchDays: number,
): Promise<YahooBar[] | null> {
  const auth = await getAuth();
  if (!auth) return null;

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - fetchDays * 24 * 3600;

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${interval}&period1=${period1}&period2=${period2}` +
    `&crumb=${encodeURIComponent(auth.crumb)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Cookie: auth.cookie },
  });

  if (res.status === 401 || res.status === 403) {
    _auth = null; // force re-auth next call
    return null;
  }
  if (!res.ok) return null;

  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const bars: YahooBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c)) continue;
    bars.push({ date: new Date(timestamps[i] * 1000).toISOString(), close: c });
  }

  return bars.length > 1 ? bars : null;
}
