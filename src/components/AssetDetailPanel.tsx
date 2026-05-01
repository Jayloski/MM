'use client';

import type { CorrelationResponse, SessionName } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

interface Props {
  ticker: string | null;
  data: CorrelationResponse;
  onClose: () => void;
}

const SESSION_STYLES: Record<SessionName, string> = {
  'Asian':         'bg-purple-950 text-purple-300 border border-purple-700',
  'European':      'bg-blue-950 text-blue-300 border border-blue-700',
  'US':            'bg-green-950 text-green-300 border border-green-700',
  'EU/US Overlap': 'bg-teal-950 text-teal-300 border border-teal-700',
};

function toDailyMovePct(annualizedVol: number): number {
  return (annualizedVol / Math.sqrt(252)) * 100;
}

function volColor(dailyMove: number): string {
  if (dailyMove < 0.5) return 'text-green-400';
  if (dailyMove < 1.5) return 'text-yellow-400';
  return 'text-red-400';
}

function getTopCorrelations(ticker: string, data: CorrelationResponse) {
  const idx = data.tickers.indexOf(ticker);
  if (idx === -1) return { positive: [], negative: [] };
  const row = data.matrix[idx];
  const sorted = data.tickers
    .map((t, i) => ({ ticker: t, label: data.labels[t] ?? t, r: row[i] ?? NaN }))
    .filter(x => x.ticker !== ticker && isFinite(x.r))
    .sort((a, b) => b.r - a.r);
  return {
    positive: sorted.slice(0, 5),
    negative: [...sorted].reverse().slice(0, 5),
  };
}

export default function AssetDetailPanel({ ticker, data, onClose }: Props) {
  const isOpen = ticker !== null;

  return (
    <div
      className={`flex w-80 min-w-[20rem] flex-col border-l border-surface-border bg-surface-raised transition-all duration-200 ${
        isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-full opacity-0'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <span className="truncate font-semibold text-white">
          {ticker ? (data.labels[ticker] ?? ticker) : ''}
        </span>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-slate-500 transition-colors hover:text-white"
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      {ticker && (() => {
        const assetClass = data.assetClasses[ticker];
        const subGroup = data.subGroups[ticker];
        const sessions = data.sessions?.[ticker] ?? [];
        const annualizedVol = data.volatility?.[ticker];
        const dailyMove = annualizedVol != null ? toDailyMovePct(annualizedVol) : null;
        const { positive, negative } = getTopCorrelations(ticker, data);
        const classColor = ASSET_CLASS_COLORS[assetClass] ?? '#888';

        return (
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* Asset metadata */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: classColor + '22', color: classColor, border: `1px solid ${classColor}55` }}
              >
                {assetClass === 'futures' ? 'Futures' : 'Forex'}
              </span>
              <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {SUBGROUP_LABELS[subGroup] ?? subGroup}
              </span>
              <span className="font-mono text-xs text-slate-500">{ticker}</span>
            </div>

            {/* Sessions */}
            {sessions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Active Sessions (CT)
                </p>
                <div className="flex flex-wrap gap-2">
                  {sessions.map((s, i) => (
                    <div
                      key={i}
                      className={`rounded-md px-2.5 py-1.5 text-xs leading-tight ${SESSION_STYLES[s.name]}`}
                    >
                      <div className="font-semibold">{s.name}</div>
                      <div className="mt-0.5 font-mono opacity-80">
                        {s.startCT} – {s.endCT}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volatility */}
            {dailyMove != null && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Volatility
                </p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${volColor(dailyMove)}`}>
                    ~{dailyMove.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-500">avg daily move</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {(annualizedVol * 100).toFixed(1)}% annualized
                </div>
              </div>
            )}

            {/* Top Correlations */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Top Correlations
              </p>

              {positive.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs text-slate-600">Positive</p>
                  <div className="space-y-1.5">
                    {positive.map(({ ticker: t, label: lbl, r }) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="w-20 truncate text-xs text-slate-400" title={lbl}>{lbl}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-blue-400"
                            style={{ width: `${Math.abs(r) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-slate-300">
                          {r.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {negative.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-slate-600">Negative</p>
                  <div className="space-y-1.5">
                    {negative.map(({ ticker: t, label: lbl, r }) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="w-20 truncate text-xs text-slate-400" title={lbl}>{lbl}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div
                            className="h-full rounded-full bg-red-400"
                            style={{ width: `${Math.abs(r) * 100}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-slate-300">
                          {r.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
