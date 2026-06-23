'use client';

import type { DivergenceResponse } from '@/types';

interface Props {
  data: DivergenceResponse;
}

function zColor(z: number): string {
  return Math.abs(z) >= 3 ? 'text-red-300' : Math.abs(z) >= 2 ? 'text-amber-300' : 'text-yellow-500';
}

function assetColor(cls: string): string {
  return cls === 'forex' ? 'text-emerald-400' : 'text-blue-400';
}

export default function DivergenceAlert({ data }: Props) {
  const top = data.pairs[0];
  if (!top) return null;

  const moverLabel   = top.moverIsA ? top.labelA : top.labelB;
  const holdoutLabel = top.moverIsA ? top.labelB : top.labelA;
  const moverCls     = top.moverIsA ? top.assetClassA : top.assetClassB;
  const holdoutCls   = top.moverIsA ? top.assetClassB : top.assetClassA;
  const moverCum     = top.moverIsA ? top.cumA : top.cumB;
  const holdoutCum   = top.moverIsA ? top.cumB : top.cumA;

  const moverSign   = moverCum   >= 0 ? '+' : '';
  const holdoutSign = holdoutCum >= 0 ? '+' : '';
  const moverPct    = `${moverSign}${(moverCum * 100).toFixed(2)}%`;
  const holdoutPct  = `${holdoutSign}${(holdoutCum * 100).toFixed(2)}%`;

  const zBadgeColor = Math.abs(top.spreadZ) >= 3
    ? 'bg-red-900/40 text-red-300'
    : Math.abs(top.spreadZ) >= 2
      ? 'bg-amber-900/40 text-amber-300'
      : 'bg-yellow-900/30 text-yellow-400';

  return (
    <section className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        Divergence Alert
      </h2>

      <div className="flex items-start gap-3">
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Mover</span>
            <span className={`font-mono text-sm font-bold ${assetColor(moverCls)}`}>{moverLabel}</span>
            <span className={`font-mono text-sm font-bold ${moverCum >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {moverPct}
            </span>
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Holdout</span>
            <span className={`font-mono text-xs ${assetColor(holdoutCls)}`}>{holdoutLabel}</span>
            <span className={`font-mono text-xs ${holdoutCum >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {holdoutPct}
            </span>
          </div>
          <div className="font-mono text-[10px] text-slate-600">
            Correlated pair · r = {top.longR.toFixed(2)} · {holdoutLabel} has not followed {moverLabel}
            {top.continuationRate !== null && ` · ${(top.continuationRate * 100).toFixed(0)}% historical follow-through`}
          </div>
        </div>

        <span className={`shrink-0 rounded px-2 py-1 font-mono text-sm font-bold ${zBadgeColor}`}>
          <span className={zColor(top.spreadZ)}>
            {top.spreadZ > 0 ? '+' : ''}{top.spreadZ.toFixed(2)}σ
          </span>
        </span>
      </div>
    </section>
  );
}
