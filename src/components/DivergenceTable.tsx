'use client';

import type { ReactNode } from 'react';
import type { DivergenceRow, DivergenceResponse } from '@/types';

interface Props {
  data: DivergenceResponse;
}

function pct(v: number) {
  return (v * 100).toFixed(0) + '%';
}

function fmtReturn(v: number) {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(2)}%`;
}

function fmtSpreadZ(z: number) {
  const sign = z >= 0 ? '+' : '';
  return `${sign}${z.toFixed(2)}σ`;
}

function fmtCorr(r: number) {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(3)}`;
}

function corrColor(r: number): string {
  const abs = Math.abs(r);
  if (abs >= 0.85) return r > 0 ? 'text-blue-300' : 'text-red-300';
  if (abs >= 0.70) return r > 0 ? 'text-blue-400' : 'text-red-400';
  return r > 0 ? 'text-blue-500' : 'text-red-500';
}

function spreadZColor(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 2.0) return 'text-amber-300';
  if (abs >= 1.5) return 'text-amber-400';
  if (abs >= 1.0) return 'text-amber-500';
  return 'text-slate-400';
}

function returnColor(v: number): string {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-red-400';
  return 'text-slate-400';
}

function momArrow(momZ: number): string | null {
  if (Math.abs(momZ) >= 1.0) return momZ > 0 ? '↑' : '↓';
  return null;
}

function statCell(pctVal: number | null, n: number): string {
  if (pctVal === null || n === 0) return '—';
  return `${pct(pctVal)} (n=${n})`;
}

function statColor(v: number | null): string {
  if (v === null) return 'text-slate-600';
  if (v >= 0.75) return 'text-emerald-400';
  if (v >= 0.50) return 'text-slate-300';
  return 'text-slate-500';
}

function Row({ row }: { row: DivergenceRow }) {
  const arrow = momArrow(row.moverMomZ);
  return (
    <tr className="border-t border-surface-border hover:bg-surface/60 transition-colors">
      {/* Pair */}
      <td className="px-3 py-2 whitespace-nowrap text-slate-300">
        <span className="font-medium">{row.labelA}</span>
        <span className="mx-1.5 text-slate-600">vs</span>
        <span className="font-medium">{row.labelB}</span>
      </td>

      {/* Corr */}
      <td className={`px-3 py-2 text-right font-mono ${corrColor(row.corrBaseline)}`}>
        {fmtCorr(row.corrBaseline)}
      </td>

      {/* Mover */}
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-slate-400 text-xs mr-1.5">{row.moverLabel}</span>
        <span className={`font-mono text-xs ${returnColor(row.moverReturn)}`}>
          {fmtReturn(row.moverReturn)}
        </span>
        {arrow && (
          <span className={`ml-1 text-xs font-bold ${row.moverMomZ > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {arrow}
          </span>
        )}
      </td>

      {/* Holdout */}
      <td className="px-3 py-2 whitespace-nowrap">
        <span className="text-slate-400 text-xs mr-1.5">{row.holdoutLabel}</span>
        <span className={`font-mono text-xs ${returnColor(row.holdoutReturn)}`}>
          {fmtReturn(row.holdoutReturn)}
        </span>
      </td>

      {/* Spread Z */}
      <td className={`px-3 py-2 text-right font-mono ${spreadZColor(row.spreadZ)}`}>
        {fmtSpreadZ(row.spreadZ)}
      </td>

      {/* Revert % */}
      <td className={`px-3 py-2 text-right font-mono text-xs ${statColor(row.revertPct)}`}>
        {statCell(row.revertPct, row.sampleN)}
      </td>

      {/* Confirm % */}
      <td className={`px-3 py-2 text-right font-mono text-xs ${statColor(row.lagPct)}`}>
        {statCell(row.lagPct, row.sampleN)}
      </td>
    </tr>
  );
}

const TH = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 ${
      right ? 'text-right' : 'text-left'
    }`}
  >
    {children}
  </th>
);

export default function DivergenceTable({ data }: Props) {
  if (data.rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-600">
        No pairs meet the divergence threshold (|r| ≥ {data.corrThreshold}, |spreadZ| ≥ 0.75) right now.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            <TH>Pair</TH>
            <TH right>Corr ({data.baseBars}b)</TH>
            <TH>Mover</TH>
            <TH>Holdout</TH>
            <TH right>Spread Z ({data.momBars}b)</TH>
            <TH right>Revert %</TH>
            <TH right>Confirm %</TH>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(row => (
            <Row key={`${row.tickerA}-${row.tickerB}`} row={row} />
          ))}
        </tbody>
      </table>
      <p className="mt-2 px-3 text-xs text-slate-700">
        Pairs with |r| ≥ {data.corrThreshold} · Mover = asset with larger |momZ| · ↑↓ = |momZ| ≥ 1.0 · Confirm % = holdout followed mover direction
      </p>
    </div>
  );
}
