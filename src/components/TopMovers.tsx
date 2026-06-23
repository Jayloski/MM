'use client';

import type { CorrelationResponse } from '@/types';

const SESSIONS = [
  { name: 'Asian',     dot: '#fbbf24', textColor: 'text-amber-400'   },
  { name: 'London',   dot: '#60a5fa', textColor: 'text-blue-400'    },
  { name: 'New York', dot: '#34d399', textColor: 'text-emerald-400' },
] as const;

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

  return (
    <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Top Movers · All Sessions
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {SESSIONS.map(session => (
          <div key={session.name}>
            {/* Session header */}
            <div className="mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: session.dot }} />
              <span className={`font-mono text-xs font-semibold ${session.textColor}`}>
                {session.name}
              </span>
            </div>

            {top5.length === 0 ? (
              <p className="font-mono text-xs text-slate-600">No data</p>
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
                    <li key={ticker} className="flex items-center gap-2">
                      <span className="w-3 shrink-0 text-right font-mono text-[10px] text-slate-600">
                        {i + 1}
                      </span>
                      <div className="relative flex h-6 flex-1 overflow-hidden rounded bg-surface">
                        <div
                          className={`absolute inset-y-0 left-0 rounded opacity-20 ${barColor}`}
                          style={{ width: `${barWidth}%` }}
                        />
                        <span className={`absolute inset-0 flex items-center px-1.5 font-mono text-[11px] font-semibold ${textColor}`}>
                          {labels[ticker] ?? ticker}
                        </span>
                      </div>
                      <span className="w-14 shrink-0 text-right font-mono text-[10px] text-slate-400">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ))}
      </div>

      <p className="mt-4 text-[10px] text-slate-600 font-mono">
        Ranked by stddev of % returns · {data.tickers.length} instruments · {data.timeframe} timeframe
      </p>
    </section>
  );
}
