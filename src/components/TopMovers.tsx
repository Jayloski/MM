'use client';

import type { CorrelationResponse } from '@/types';

const SESSION_HOURS_CT: Record<string, [number, number]> = {
  Asian:     [19, 28], // 7pm–4am (next day), wraps midnight
  London:    [2,  11], // 2am–11am CT (CDT)
  'New York': [8, 17], // 8am–5pm CT (CDT)
};

function getActiveSessions(): string[] {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const hourCT = h === 24 ? 0 : h;

  return Object.entries(SESSION_HOURS_CT)
    .filter(([, [start, end]]) => {
      if (end > 24) {
        // wraps midnight
        return hourCT >= start || hourCT < (end - 24);
      }
      return hourCT >= start && hourCT < end;
    })
    .map(([name]) => name);
}

interface Props {
  data: CorrelationResponse;
}

export default function TopMovers({ data }: Props) {
  const { tickers, labels, assetClasses, volatility } = data;

  const sorted = [...tickers]
    .filter(t => (volatility[t] ?? 0) > 0)
    .sort((a, b) => (volatility[b] ?? 0) - (volatility[a] ?? 0));

  const top5 = sorted.slice(0, 5);
  const maxVol = volatility[top5[0]] ?? 1;

  const active = getActiveSessions();
  const sessionLabel = active.length > 0 ? active.join(' + ') : 'Current';

  return (
    <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Top Movers · <span className="text-slate-400 normal-case">{sessionLabel} Session</span>
      </h2>

      {top5.length === 0 ? (
        <p className="text-xs text-slate-600 font-mono">No volatility data available.</p>
      ) : (
        <ol className="space-y-2">
          {top5.map((ticker, i) => {
            const vol = volatility[ticker] ?? 0;
            const pct = (vol * 100).toFixed(3);
            const isForex = assetClasses[ticker] === 'forex';
            const barColor = isForex ? 'bg-emerald-400' : 'bg-blue-400';
            const textColor = isForex ? 'text-emerald-400' : 'text-blue-400';
            const barWidth = maxVol > 0 ? (vol / maxVol) * 100 : 0;

            return (
              <li key={ticker} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-right font-mono text-xs text-slate-600">
                  {i + 1}
                </span>
                <div className="relative flex h-7 flex-1 overflow-hidden rounded bg-surface">
                  <div
                    className={`absolute inset-y-0 left-0 rounded opacity-20 ${barColor}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className={`absolute inset-0 flex items-center px-2 font-mono text-xs font-semibold ${textColor}`}>
                    {labels[ticker] ?? ticker}
                  </span>
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-300">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-3 text-[10px] text-slate-600 font-mono">
        Ranked by stddev of % returns · {data.tickers.length} instruments · {data.timeframe} timeframe
      </p>
    </section>
  );
}
