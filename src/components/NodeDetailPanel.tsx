'use client';

import type { CorrelationResponse } from '@/types';

interface Props {
  ticker: string;
  data: CorrelationResponse;
  onClose: () => void;
}

function rBar(r: number) {
  const pct = Math.abs(r) * 100;
  const color = r > 0 ? 'bg-blue-500' : 'bg-red-500';
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-border">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function rColor(r: number) {
  const abs = Math.abs(r);
  if (abs >= 0.8) return r > 0 ? 'text-blue-300' : 'text-red-300';
  if (abs >= 0.6) return r > 0 ? 'text-blue-400' : 'text-red-400';
  return 'text-slate-400';
}

export default function NodeDetailPanel({ ticker, data, onClose }: Props) {
  const idx = data.tickers.indexOf(ticker);
  if (idx === -1) return null;

  const label = data.labels[ticker] ?? ticker;
  const assetClass = data.assetClasses[ticker];
  const vol = data.volatility?.[ticker];

  // Build sorted correlations with all other tickers
  const corrs = data.tickers
    .map((t, i) => ({ ticker: t, label: data.labels[t] ?? t, r: data.matrix[idx][i] }))
    .filter(c => c.ticker !== ticker && c.r != null)
    .sort((a, b) => Math.abs(b.r!) - Math.abs(a.r!)) as { ticker: string; label: string; r: number }[];

  const strong = corrs.filter(c => Math.abs(c.r) >= 0.6);
  const rest   = corrs.filter(c => Math.abs(c.r) < 0.6);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-surface-border px-4 py-3">
        <div>
          <div className="font-mono text-sm font-bold text-slate-100">{label}</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
            {assetClass} · {ticker}
          </div>
          {vol != null && (
            <div className="mt-1 font-mono text-xs text-amber-400">
              σ {(vol * 100).toFixed(3)}%
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-4 shrink-0 rounded p-1 text-slate-500 hover:bg-surface-border hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {strong.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Strong correlations · |r| ≥ 0.60
            </div>
            <div className="space-y-2.5">
              {strong.map(c => (
                <div key={c.ticker}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-300">{c.label}</span>
                    <span className={`font-mono text-xs font-bold ${rColor(c.r)}`}>
                      {c.r > 0 ? '+' : ''}{c.r.toFixed(2)}
                    </span>
                  </div>
                  {rBar(c.r)}
                </div>
              ))}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Weak / uncorrelated
            </div>
            <div className="space-y-2">
              {rest.map(c => (
                <div key={c.ticker} className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-slate-500">{c.label}</span>
                  <span className="font-mono text-[11px] text-slate-600">
                    {c.r > 0 ? '+' : ''}{c.r.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
