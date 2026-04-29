'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DivergencePair, DivergenceResponse, Timeframe, AssetClass } from '@/types';

interface Props {
  timeframe: Timeframe;
  activeClasses: Set<AssetClass>;
  threshold: number;
  onPairClick: (a: string, b: string, aLabel: string, bLabel: string) => void;
}

type ScannerMode = 'correlation' | 'spread';

const SHORT_WINDOW_OPTIONS = [10, 20, 30] as const;
const LONG_WINDOW_OPTIONS  = [40, 60, 90] as const;

function rColor(r: number): string {
  if (r >= 0.7)  return '#60a5fa';
  if (r >= 0.4)  return '#93c5fd';
  if (r <= -0.7) return '#f87171';
  if (r <= -0.4) return '#fca5a5';
  return '#64748b';
}

function RCell({ value }: { value: number }) {
  return (
    <span className="font-mono text-[11px]" style={{ color: rColor(value) }}>
      {value >= 0 ? '+' : ''}{value.toFixed(3)}
    </span>
  );
}

function DivergenceBadge({ score }: { score: number }) {
  const pct = Math.min(score / 1.5, 1);
  const color = pct > 0.6 ? '#f59e0b' : pct > 0.35 ? '#fb923c' : '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}18` }}
    >
      Δ {score.toFixed(2)}
    </span>
  );
}

function PctCell({ value }: { value: number }) {
  const pct = value * 100;
  const color = pct > 0 ? '#34d399' : pct < 0 ? '#f87171' : '#64748b';
  return (
    <span className="font-mono text-[11px]" style={{ color }}>
      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
    </span>
  );
}

function SpreadZBadge({ z }: { z: number }) {
  const abs = Math.abs(z);
  const color = abs >= 2.5 ? '#f59e0b' : abs >= 1.5 ? '#fb923c' : '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {z >= 0 ? '+' : ''}{z.toFixed(2)}σ
    </span>
  );
}

export default function DivergenceScanner({ timeframe, activeClasses, threshold, onPairClick }: Props) {
  const [data, setData]           = useState<DivergenceResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [mode, setMode]           = useState<ScannerMode>('correlation');
  const [shortWindow, setShortWindow] = useState<number>(20);
  const [longWindow,  setLongWindow]  = useState<number>(60);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);

  // Clear row highlight when switching modes
  useEffect(() => { setHighlightIdx(null); }, [mode]);

  const fetchDivergence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeframe,
        classes:     Array.from(activeClasses).join(','),
        shortWindow: String(shortWindow),
        longWindow:  String(longWindow),
        mode,
      });
      if (mode === 'spread') {
        params.set('minLongR', threshold.toFixed(3));
      }
      const res = await fetch(`/api/divergence?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [timeframe, activeClasses, shortWindow, longWindow, mode, threshold]);

  useEffect(() => {
    fetchDivergence();
  }, [fetchDivergence]);

  return (
    <section>
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Divergence Scanner
        </h2>

        {/* Mode subtitle */}
        <span className="text-xs text-slate-600">
          {mode === 'correlation'
            ? '— short-window r vs long-window r shift'
            : `— spread z-score for web pairs (|Long r| ≥ ${threshold.toFixed(2)})`}
        </span>

        {/* Mode toggle */}
        <div className="flex rounded border border-surface-border p-0.5">
          {(['correlation', 'spread'] as ScannerMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                mode === m
                  ? 'bg-surface-border text-slate-200'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m === 'correlation' ? 'Correlation Shift' : 'Price Divergence'}
            </button>
          ))}
        </div>

        {/* Window controls */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-slate-600">Short</span>
          <div className="flex rounded border border-surface-border p-0.5">
            {SHORT_WINDOW_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => setShortWindow(w)}
                className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                  shortWindow === w
                    ? 'bg-surface-border text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-600">Long</span>
          <div className="flex rounded border border-surface-border p-0.5">
            {LONG_WINDOW_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => setLongWindow(w)}
                className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors ${
                  longWindow === w
                    ? 'bg-surface-border text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <button
            onClick={fetchDivergence}
            disabled={loading}
            title="Refresh"
            className="rounded p-1 text-slate-500 transition-colors hover:text-slate-200 disabled:opacity-30"
          >
            <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
            </svg>
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-raised">
        {error && (
          <div className="px-4 py-3 text-sm text-red-400">{error}</div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-12 text-xs text-slate-600">
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
            </svg>
            {mode === 'spread' ? 'Scanning price divergence…' : 'Computing divergence…'}
          </div>
        )}

        {data && data.pairs.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-slate-600">
            {mode === 'spread'
              ? `No pairs with |Long r| ≥ ${threshold.toFixed(2)} and sufficient data`
              : 'No pairs with sufficient shared data'}
          </div>
        )}

        {data && data.pairs.length > 0 && (
          <div className={`transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
            {/* Legend */}
            <div className="flex items-center gap-4 border-b border-surface-border px-4 py-2 text-[10px] text-slate-600">
              {data.mode === 'correlation' ? (
                <span>
                  Short r = last <strong className="text-slate-400">{data.shortWindow}</strong> bars ·
                  Long r = last <strong className="text-slate-400">{data.longWindow}</strong> bars ·
                  Δ = |short − long|
                </span>
              ) : (
                <span>
                  Spread Z = cumulative {data.shortWindow}-bar return spread vs {data.longWindow}-bar baseline ·
                  Long r baseline filter: |r| ≥ <strong className="text-slate-400">{threshold.toFixed(2)}</strong>
                </span>
              )}
              <span className="ml-auto">{data.pairs.length} pairs</span>
            </div>

            {/* ── Correlation Shift table ── */}
            {data.mode === 'correlation' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-[10px] uppercase tracking-widest text-slate-600">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Pair</th>
                    <th className="px-4 py-2 text-right">Short r</th>
                    <th className="px-4 py-2 text-right">Long r</th>
                    <th className="px-4 py-2 text-right">Divergence Δ</th>
                    <th className="px-4 py-2 text-center">Direction</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.map((pair, i) => {
                    const collapsed = pair.shortR > 0 && pair.longR > 0
                      ? pair.shortR < pair.longR
                      : pair.shortR < 0 && pair.longR < 0
                      ? pair.shortR > pair.longR
                      : null;
                    const dirLabel = collapsed === true ? 'Collapsing' : collapsed === false ? 'Strengthening' : 'Sign flip';
                    const dirColor = collapsed === true ? '#f59e0b' : collapsed === false ? '#34d399' : '#a78bfa';

                    return (
                      <tr
                        key={`${pair.a}-${pair.b}`}
                        className={`cursor-pointer border-b border-surface-border/50 transition-colors last:border-0 ${
                          highlightIdx === i ? 'bg-surface-border/30' : 'hover:bg-surface-border/20'
                        }`}
                        onClick={() => { setHighlightIdx(i); onPairClick(pair.a, pair.b, pair.aLabel, pair.bLabel); }}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-600">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-200">{pair.aLabel}</span>
                          <span className="mx-1.5 text-slate-600">vs</span>
                          <span className="font-semibold text-slate-200">{pair.bLabel}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right"><RCell value={pair.shortR} /></td>
                        <td className="px-4 py-2.5 text-right"><RCell value={pair.longR} /></td>
                        <td className="px-4 py-2.5 text-right"><DivergenceBadge score={pair.divergence} /></td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: dirColor, backgroundColor: `${dirColor}18` }}>
                            {dirLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* ── Price Divergence table ── */}
            {data.mode === 'spread' && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-[10px] uppercase tracking-widest text-slate-600">
                    <th className="px-4 py-2 text-left">#</th>
                    <th className="px-4 py-2 text-left">Pair</th>
                    <th className="px-4 py-2 text-right">Long r</th>
                    <th className="px-4 py-2 text-right">A return</th>
                    <th className="px-4 py-2 text-right">B return</th>
                    <th className="px-4 py-2 text-right">Spread Z</th>
                    <th className="px-4 py-2 text-center">Leading</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.map((pair, i) => {
                    const z = pair.spreadZ ?? 0;
                    const leadLabel = Math.abs(z) < 0.3 ? 'Neutral' : z > 0 ? pair.aLabel : pair.bLabel;
                    const leadColor = Math.abs(z) < 0.3 ? '#64748b' : z > 0 ? '#34d399' : '#f87171';

                    return (
                      <tr
                        key={`${pair.a}-${pair.b}`}
                        className={`cursor-pointer border-b border-surface-border/50 transition-colors last:border-0 ${
                          highlightIdx === i ? 'bg-surface-border/30' : 'hover:bg-surface-border/20'
                        }`}
                        onClick={() => { setHighlightIdx(i); onPairClick(pair.a, pair.b, pair.aLabel, pair.bLabel); }}
                      >
                        <td className="px-4 py-2.5 font-mono text-slate-600">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-200">{pair.aLabel}</span>
                          <span className="mx-1.5 text-slate-600">vs</span>
                          <span className="font-semibold text-slate-200">{pair.bLabel}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right"><RCell value={pair.longR} /></td>
                        <td className="px-4 py-2.5 text-right">
                          {pair.cumA != null ? <PctCell value={pair.cumA} /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {pair.cumB != null ? <PctCell value={pair.cumB} /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right"><SpreadZBadge z={z} /></td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{ color: leadColor, backgroundColor: `${leadColor}18` }}
                          >
                            {leadLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
