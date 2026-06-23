'use client';

import type { CorrelationResponse } from '@/types';

interface Props {
  data: CorrelationResponse;
}

export default function DivergenceAlert({ data }: Props) {
  const { tickers, labels, assetClasses, volatility } = data;

  if (tickers.length === 0) return null;

  const top = tickers.reduce((best, t) =>
    (volatility[t] ?? 0) > (volatility[best] ?? 0) ? t : best,
    tickers[0],
  );

  const vol = volatility[top] ?? 0;
  if (vol === 0) return null;

  const pct = (vol * 100).toFixed(3);
  const isForex = assetClasses[top] === 'forex';
  const tickerColor = isForex ? 'text-emerald-400' : 'text-blue-400';
  const label = labels[top] ?? top;
  const assetClass = assetClasses[top];

  // Rank among all tickers
  const rank = [...tickers]
    .sort((a, b) => (volatility[b] ?? 0) - (volatility[a] ?? 0))
    .indexOf(top) + 1;

  return (
    <section className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Divergence Alert
      </h2>

      <div className="flex items-start gap-3">
        {/* Warning icon */}
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Highest Volatility
            </span>
            <span className={`font-mono text-sm font-bold ${tickerColor}`}>
              {label}
            </span>
          </div>
          <div className="font-mono text-xs text-slate-400">
            stddev {pct}% · {assetClass} · ranked #{rank} of {tickers.length}
          </div>
          <div className="mt-2 font-mono text-[10px] text-slate-600">
            This instrument shows the largest return dispersion in the current lookback window.
            High stddev = elevated intraday range expected.
          </div>
        </div>

        {/* Value badge */}
        <span className="shrink-0 rounded bg-amber-900/40 px-2 py-1 font-mono text-sm font-bold text-amber-300">
          {pct}%
        </span>
      </div>
    </section>
  );
}
