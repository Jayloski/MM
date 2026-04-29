'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AssetClass, DivergenceResponse, DivergencePair, Timeframe } from '@/types';
import { ALL_ASSET_CLASSES } from '@/lib/assets';

// ── formatting helpers ─────────────────────────────────────────────────────

function fmtPct(v: number | undefined) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}

function pctColor(v: number | undefined) {
  if (v == null) return 'text-slate-500';
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-slate-400';
}

// ── sub-components ─────────────────────────────────────────────────────────

function MomentumArrow({ momZ, cum }: { momZ: number; cum: number }) {
  if (Math.abs(momZ) < 1.0) return null;
  const up = cum >= 0;
  const strong = Math.abs(momZ) >= 2.0;
  return (
    <span className={`ml-0.5 text-xs ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      {up ? (strong ? '↑↑' : '↑') : (strong ? '↓↓' : '↓')}
    </span>
  );
}

function SpreadZBadge({ z }: { z: number }) {
  const abs = Math.abs(z);
  const bg = abs >= 2.5 ? 'bg-orange-600' : abs >= 1.5 ? 'bg-amber-700' : 'bg-surface-border';
  return (
    <span className={`rounded px-1.5 py-0.5 font-mono text-xs font-bold text-white ${bg}`}>
      {z >= 0 ? '+' : ''}{z.toFixed(2)}σ
    </span>
  );
}

function ConfirmCell({
  continuationRate,
  followRate,
  sampleCount,
}: {
  continuationRate?: number;
  followRate?: number;
  sampleCount?: number;
}) {
  if (continuationRate == null || sampleCount == null) {
    return <span className="text-xs text-slate-600">—</span>;
  }
  const pct = Math.round(continuationRate * 100);
  const revertPct = followRate != null ? Math.round(followRate * 100) : null;
  const color = pct >= 60 ? 'text-amber-400' : pct >= 40 ? 'text-orange-400' : 'text-slate-500';
  return (
    <div className="text-xs leading-snug">
      <div className={`font-semibold ${color}`}>{pct}% confirm</div>
      {revertPct != null && (
        <div className="text-slate-500">{revertPct}% revert ({sampleCount})</div>
      )}
    </div>
  );
}

// ── pair row ───────────────────────────────────────────────────────────────

function PairRow({ pair, rank }: { pair: DivergencePair; rank: number }) {
  const hasClearSignal = pair.moverIsA != null;
  const aIsMover = pair.moverIsA !== false;

  const moverLabel   = hasClearSignal ? (aIsMover ? pair.aLabel : pair.bLabel) : null;
  const holdoutLabel = hasClearSignal ? (aIsMover ? pair.bLabel : pair.aLabel) : null;
  const moverCum     = hasClearSignal ? (aIsMover ? pair.cumA   : pair.cumB)   : undefined;
  const holdoutCum   = hasClearSignal ? (aIsMover ? pair.cumB   : pair.cumA)   : undefined;
  const moverMomZ    = hasClearSignal ? (aIsMover ? pair.momentumZA : pair.momentumZB) : undefined;
  const holdoutMomZ  = hasClearSignal ? (aIsMover ? pair.momentumZB : pair.momentumZA) : undefined;
  const moverColor   = (moverCum ?? 0) < 0 ? '#f87171' : '#34d399';
  const longRColor   = pair.longR > 0 ? 'text-blue-400' : 'text-orange-400';

  return (
    <tr className="border-b border-surface-border/50 transition-colors hover:bg-white/[0.02]">
      <td className="px-4 py-2.5 text-xs text-slate-600">{rank}</td>
      <td className="px-4 py-2.5">
        <span className="text-sm font-semibold text-slate-200">{pair.aLabel}</span>
        <span className="mx-1.5 text-xs text-slate-600">vs</span>
        <span className="text-sm font-semibold text-slate-200">{pair.bLabel}</span>
      </td>
      <td className={`px-4 py-2.5 text-right font-mono text-sm ${longRColor}`}>
        {pair.longR >= 0 ? '+' : ''}{pair.longR.toFixed(3)}
      </td>
      {/* Mover */}
      <td className="px-4 py-2.5">
        {!hasClearSignal ? (
          <span className="text-xs text-slate-600">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold" style={{ color: moverColor }}>
              {moverLabel}
            </span>
            <span className={`font-mono text-xs ${pctColor(moverCum)}`}>
              {fmtPct(moverCum)}
            </span>
            {moverMomZ != null && moverCum != null && (
              <MomentumArrow momZ={moverMomZ} cum={moverCum} />
            )}
          </div>
        )}
      </td>
      {/* Holdout */}
      <td className="px-4 py-2.5">
        {!hasClearSignal ? (
          <span className="text-xs text-slate-600">—</span>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-300">{holdoutLabel}</span>
            <span className={`font-mono text-xs ${pctColor(holdoutCum)}`}>
              {fmtPct(holdoutCum)}
            </span>
            {holdoutMomZ != null && holdoutCum != null && (
              <MomentumArrow momZ={holdoutMomZ} cum={holdoutCum} />
            )}
          </div>
        )}
      </td>
      {/* Spread Z */}
      <td className="px-4 py-2.5 text-center">
        <SpreadZBadge z={pair.spreadZ} />
      </td>
      {/* Confirm % */}
      <td className="px-4 py-2.5">
        <ConfirmCell
          continuationRate={pair.continuationRate}
          followRate={pair.followRate}
          sampleCount={pair.sampleCount}
        />
      </td>
    </tr>
  );
}

// ── window option sets ─────────────────────────────────────────────────────

const SHORT_OPTIONS = [10, 20, 30] as const;
const LONG_OPTIONS  = [40, 60, 90] as const;
const TIMEFRAMES: Timeframe[] = ['5m', '15m', '1h', '4h', '1d'];

// ── main component ─────────────────────────────────────────────────────────

export default function DivergenceScanner() {
  const [timeframe,   setTimeframe]   = useState<Timeframe>('1h');
  const [shortWindow, setShortWindow] = useState(20);
  const [longWindow,  setLongWindow]  = useState(60);
  const [minLongR]                    = useState(0.35);
  const [classes]                     = useState<Set<AssetClass>>(new Set(ALL_ASSET_CLASSES));
  const [tab,         setTab]         = useState<'spread' | 'correlation'>('spread');
  const [data,        setData]        = useState<DivergenceResponse | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        timeframe,
        classes: Array.from(classes).join(','),
        shortWindow: String(shortWindow),
        longWindow:  String(longWindow),
        minLongR:    String(minLongR),
      });
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
  }, [timeframe, classes, shortWindow, longWindow, minLongR]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="rounded-lg border border-surface-border bg-surface-raised">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-white">
            Divergence Scanner
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            — spread z-score for web pairs (|Long r| ≥ {minLongR.toFixed(2)})
          </span>
          {/* Mode tabs */}
          <div className="flex overflow-hidden rounded border border-surface-border">
            <button
              onClick={() => setTab('correlation')}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                tab === 'correlation'
                  ? 'bg-surface-border text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Correlation Shift
            </button>
            <button
              onClick={() => setTab('spread')}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${
                tab === 'spread'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Price Divergence
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe */}
          <div className="flex gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${
                  timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-border text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-surface-border" />
          {/* Short window */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Short</span>
            {SHORT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setShortWindow(n)}
                className={`rounded px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${
                  shortWindow === n
                    ? 'bg-surface-border text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {/* Long window */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Long</span>
            {LONG_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setLongWindow(n)}
                className={`rounded px-2 py-0.5 font-mono text-xs font-semibold transition-colors ${
                  longWindow === n
                    ? 'bg-surface-border text-white'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh"
            className="rounded p-1 text-slate-400 transition-colors hover:text-white disabled:opacity-40"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Subtitle bar */}
      <div className="flex items-center justify-between border-b border-surface-border bg-surface/50 px-4 py-1.5">
        <span className="text-xs text-slate-500">
          Spread Z = cumulative {shortWindow}-bar return spread vs {longWindow}-bar baseline
          {' · '}Long r baseline filter: |r| ≥ {minLongR.toFixed(2)}
        </span>
        {data && (
          <span className="text-xs text-slate-600">{data.pairs.length} pairs</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="m-3 rounded border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Table */}
      {tab === 'spread' ? (
        <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : 'opacity-100'}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="w-8 px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Pair</th>
                <th className="px-4 py-2 text-right">Long r</th>
                <th className="px-4 py-2 text-left">Mover</th>
                <th className="px-4 py-2 text-left">Holdout</th>
                <th className="px-4 py-2 text-center">Spread Z</th>
                <th className="px-4 py-2 text-left">Confirm %</th>
              </tr>
            </thead>
            <tbody>
              {!data || data.pairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-600">
                    {loading ? 'Loading…' : 'No pairs match the current filters'}
                  </td>
                </tr>
              ) : (
                data.pairs.map((pair, idx) => (
                  <PairRow
                    key={`${pair.aLabel}-${pair.bLabel}`}
                    pair={pair}
                    rank={idx + 1}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center py-16 text-xs text-slate-600">
          Correlation Shift scanner — coming soon
        </div>
      )}
    </div>
  );
}
