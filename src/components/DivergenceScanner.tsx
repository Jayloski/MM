'use client';

import { useState, useMemo } from 'react';
import type { DivergencePair, DivergenceResponse } from '@/types';

type SortKey = 'spreadZ' | 'longR' | 'moverPct' | 'confirmPct';

function rColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.8) return r > 0 ? 'text-emerald-400' : 'text-red-400';
  if (abs >= 0.6) return r > 0 ? 'text-emerald-600' : 'text-red-600';
  return 'text-slate-400';
}

function zColor(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 3) return 'text-red-300';
  if (abs >= 2) return 'text-amber-300';
  return 'text-yellow-500';
}

function assetColor(cls: string): string {
  return cls === 'forex' ? 'text-emerald-400' : 'text-blue-400';
}

function SortBtn({
  col, sortKey, sortDir, onClick, children,
}: {
  col: SortKey; sortKey: SortKey | null; sortDir: 'asc' | 'desc';
  onClick: () => void; children: React.ReactNode;
}) {
  const indicator = sortKey === col
    ? (sortDir === 'desc' ? ' ↓' : ' ↑')
    : <span className="text-slate-700"> ↕</span>;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 transition-colors select-none"
    >
      {children}{indicator}
    </button>
  );
}

function PairRow({ pair }: { pair: DivergencePair }) {
  const moverLabel   = pair.moverIsA ? pair.labelA : pair.labelB;
  const moverCls     = pair.moverIsA ? pair.assetClassA : pair.assetClassB;
  const moverCum     = pair.moverIsA ? pair.cumA : pair.cumB;
  const holdoutIsA   = !pair.moverIsA;
  const sign = moverCum >= 0 ? '+' : '';

  return (
    <tr className="border-t border-surface-border hover:bg-white/[0.02] transition-colors">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-xs font-semibold ${assetColor(pair.assetClassA)}`}>{pair.labelA}</span>
          {holdoutIsA && <span className="rounded bg-slate-800 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-slate-500">holdout</span>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-[11px] ${assetColor(pair.assetClassB)}`}>{pair.labelB}</span>
          {!holdoutIsA && <span className="rounded bg-slate-800 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-slate-500">holdout</span>}
        </div>
      </td>
      <td className={`px-3 py-2.5 text-center font-mono text-sm font-bold ${rColor(pair.longR)}`}>
        {pair.longR.toFixed(2)}
      </td>
      <td className="px-3 py-2.5">
        <span className={`font-mono text-xs font-semibold ${assetColor(moverCls)}`}>{moverLabel}</span>
        <span className={`ml-2 font-mono text-xs ${moverCum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {sign}{(moverCum * 100).toFixed(2)}%
        </span>
      </td>
      <td className={`px-3 py-2.5 text-center font-mono text-sm font-bold ${zColor(pair.spreadZ)}`}>
        {pair.spreadZ > 0 ? '+' : ''}{pair.spreadZ.toFixed(2)}σ
      </td>
      <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">
        {pair.continuationRate !== null
          ? `${(pair.continuationRate * 100).toFixed(0)}%`
          : <span className="text-slate-600">—</span>}
      </td>
    </tr>
  );
}

function PairsSection({
  pairs, title, borderCls, sortKey, sortDir, onSort,
}: {
  pairs: DivergencePair[]; title: string; borderCls: string;
  sortKey: SortKey | null; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void;
}) {
  if (pairs.length === 0) return null;
  const s = { sortKey, sortDir };

  return (
    <section className={`rounded-lg border ${borderCls} bg-surface-raised overflow-hidden`}>
      <div className="border-b border-surface-border px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px]">
          <thead className="bg-surface/40">
            <tr>
              <th className="px-3 py-2 text-left">
                <SortBtn col="spreadZ" {...s} onClick={() => onSort('spreadZ')}>Pair</SortBtn>
              </th>
              <th className="px-3 py-2 text-center">
                <SortBtn col="longR" {...s} onClick={() => onSort('longR')}>Long r</SortBtn>
              </th>
              <th className="px-3 py-2 text-left">
                <SortBtn col="moverPct" {...s} onClick={() => onSort('moverPct')}>Mover</SortBtn>
              </th>
              <th className="px-3 py-2 text-center">
                <SortBtn col="spreadZ" {...s} onClick={() => onSort('spreadZ')}>Spread Z</SortBtn>
              </th>
              <th className="px-3 py-2 text-center">
                <SortBtn col="confirmPct" {...s} onClick={() => onSort('confirmPct')}>Confirm %</SortBtn>
              </th>
            </tr>
          </thead>
          <tbody>
            {pairs.map(p => (
              <PairRow key={`${p.tickerA}-${p.tickerB}`} pair={p} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface Props {
  data: DivergenceResponse;
}

export default function DivergenceScanner({ data }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    const copy = [...data.pairs];
    if (!sortKey) return copy;
    copy.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case 'spreadZ':    va = Math.abs(a.spreadZ); vb = Math.abs(b.spreadZ); break;
        case 'longR':      va = Math.abs(a.longR);   vb = Math.abs(b.longR);   break;
        case 'moverPct':
          va = Math.abs(a.moverIsA ? a.cumA : a.cumB);
          vb = Math.abs(b.moverIsA ? b.cumA : b.cumB);
          break;
        case 'confirmPct':
          va = a.continuationRate ?? -1;
          vb = b.continuationRate ?? -1;
          break;
        default: return 0;
      }
      return sortDir === 'desc' ? vb - va : va - vb;
    });
    return copy;
  }, [data.pairs, sortKey, sortDir]);

  const qualified = sorted.filter(p => Math.abs(p.spreadZ) >= 2.0);
  const possible  = sorted.filter(p => Math.abs(p.spreadZ) >= 1.5 && Math.abs(p.spreadZ) < 2.0);
  const tableProps = { sortKey, sortDir, onSort: handleSort };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Divergence Scanner
          <span className="ml-2 font-normal normal-case text-slate-600">
            · {data.shortWindow}-bar window · min |r| 0.60 · {data.timeframe} timeframe
          </span>
        </h2>
        <span className="font-mono text-xs text-slate-600">
          {qualified.length + possible.length} pairs
        </span>
      </div>

      {qualified.length === 0 && possible.length === 0 && (
        <div className="rounded-lg border border-surface-border bg-surface-raised px-4 py-10 text-center text-sm text-slate-500">
          No divergences detected above the 1.5σ threshold.
          <div className="mt-1 text-xs text-slate-600">Markets may be in sync — check again later or lower the Min R threshold.</div>
        </div>
      )}

      <PairsSection
        {...tableProps}
        pairs={qualified}
        title={`Qualified — |Z| ≥ 2.0 · ${qualified.length} pairs`}
        borderCls="border-amber-800/50"
      />
      <PairsSection
        {...tableProps}
        pairs={possible}
        title={`Possible — 1.5 ≤ |Z| < 2.0 · ${possible.length} pairs`}
        borderCls="border-surface-border"
      />

      {data.skipped.length > 0 && (
        <p className="font-mono text-[10px] text-slate-600">
          Excluded: {data.skipped.join(', ')}
        </p>
      )}
    </div>
  );
}
