'use client';

import TimeframeSelector from '@/components/TimeframeSelector';
import AssetClassFilter from '@/components/AssetClassFilter';
import Navbar from '@/components/Navbar';
import { useCorrelationData } from '@/hooks/useCorrelationData';

function SkeletonBlock({ height }: { height: number }) {
  return (
    <div className="w-full animate-pulse rounded-lg bg-surface-raised" style={{ height }} />
  );
}

export default function DivergencePage() {
  const {
    timeframe, setTimeframe,
    activeClasses, setActiveClasses,
    data, loading, error,
  } = useCorrelationData();

  const ranked = data
    ? [...data.tickers]
        .filter(t => (data.volatility[t] ?? 0) > 0)
        .sort((a, b) => (data.volatility[b] ?? 0) - (data.volatility[a] ?? 0))
    : [];

  const maxVol = ranked.length > 0 ? (data?.volatility[ranked[0]] ?? 1) : 1;

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Navbar data={data} />

      <div className="border-b border-surface-border bg-surface-raised">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} />
          <div className="h-5 w-px bg-surface-border" />
          <AssetClassFilter active={activeClasses} onChange={setActiveClasses} />
        </div>
      </div>

      <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        {error && (
          <div className="rounded border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            Failed to load data: {error}
          </div>
        )}

        {loading && !data && <SkeletonBlock height={600} />}

        {data && (
          <>
            {/* Alert — highest stddev */}
            {ranked.length > 0 && (() => {
              const top = ranked[0];
              const vol = data.volatility[top] ?? 0;
              const isForex = data.assetClasses[top] === 'forex';
              return (
                <div className="flex items-start gap-3 rounded-lg border border-amber-800/60 bg-amber-950/20 px-4 py-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Highest Volatility</span>
                      <span className={`font-mono text-sm font-bold ${isForex ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {data.labels[top] ?? top}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-400">
                      stddev {(vol * 100).toFixed(3)}% · {data.assetClasses[top]} · ranked #1 of {ranked.length}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-amber-900/40 px-2 py-1 font-mono text-sm font-bold text-amber-300">
                    {(vol * 100).toFixed(3)}%
                  </span>
                </div>
              );
            })()}

            {/* Full ranked table */}
            <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Volatility Ranking — All Instruments
                <span className="ml-2 font-normal normal-case text-slate-600">· stddev of % returns · {data.timeframe} timeframe</span>
              </h2>

              <div className="space-y-1.5">
                {ranked.map((ticker, i) => {
                  const vol = data.volatility[ticker] ?? 0;
                  const pct = (vol * 100).toFixed(3);
                  const isForex = data.assetClasses[ticker] === 'forex';
                  const barColor = isForex ? 'bg-emerald-400' : 'bg-blue-400';
                  const textColor = isForex ? 'text-emerald-400' : 'text-blue-400';
                  const barWidth = maxVol > 0 ? (vol / maxVol) * 100 : 0;
                  const isTop = i === 0;

                  return (
                    <div
                      key={ticker}
                      className={`flex items-center gap-3 rounded px-2 py-1 ${isTop ? 'bg-amber-950/20 border border-amber-800/30' : ''}`}
                    >
                      <span className="w-6 shrink-0 text-right font-mono text-xs text-slate-600">
                        {i + 1}
                      </span>
                      <span className={`w-28 shrink-0 font-mono text-xs font-semibold ${textColor}`}>
                        {data.labels[ticker] ?? ticker}
                      </span>
                      <span className="w-16 shrink-0 font-mono text-[10px] text-slate-500">
                        {data.assetClasses[ticker]}
                      </span>
                      <div className="relative flex-1 h-5 overflow-hidden rounded bg-surface">
                        <div
                          className={`absolute inset-y-0 left-0 rounded opacity-30 ${barColor} ${isTop ? 'opacity-50' : ''}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={`w-16 shrink-0 text-right font-mono text-xs ${isTop ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
