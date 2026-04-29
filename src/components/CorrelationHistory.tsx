'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { HistoryPoint } from '@/types';

interface Props {
  aLabel: string;
  bLabel: string;
  points: HistoryPoint[];
  currentR: number | null;
  loading: boolean;
  windowBars: number;
  onClose: () => void;
}

const W = 460;
const H = 200;
const M = { top: 16, right: 16, bottom: 28, left: 38 };

export default function CorrelationHistory({
  aLabel,
  bLabel,
  points,
  currentR,
  loading,
  windowBars,
  onClose,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const iW = W - M.left - M.right;
    const iH = H - M.top - M.bottom;

    svg.attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H);

    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    const dates = points.map(p => new Date(p.date.length === 10 ? p.date + 'T12:00:00Z' : p.date));
    const xScale = d3.scaleTime([dates[0], dates[dates.length - 1]], [0, iW]);
    const yScale = d3.scaleLinear([-1, 1], [iH, 0]);

    // Background bands
    g.append('rect').attr('width', iW).attr('height', iH).attr('fill', '#0a0d14');

    // Reference lines
    [0, 0.5, -0.5, 0.7, -0.7].forEach(v => {
      g.append('line')
        .attr('x1', 0).attr('x2', iW)
        .attr('y1', yScale(v)).attr('y2', yScale(v))
        .attr('stroke', v === 0 ? '#334155' : '#1e293b')
        .attr('stroke-width', v === 0 ? 1.5 : 1)
        .attr('stroke-dasharray', v === 0 ? '' : '3 3');
    });

    // Area fills
    g.append('path')
      .datum(points)
      .attr('fill', '#3b82f620')
      .attr(
        'd',
        d3.area<HistoryPoint>()
          .x((p, i) => xScale(dates[i]))
          .y0(yScale(0))
          .y1(p => yScale(Math.max(0, p.r)))
          .curve(d3.curveBasis)(points) ?? '',
      );

    g.append('path')
      .datum(points)
      .attr('fill', '#ef444420')
      .attr(
        'd',
        d3.area<HistoryPoint>()
          .x((p, i) => xScale(dates[i]))
          .y0(yScale(0))
          .y1(p => yScale(Math.min(0, p.r)))
          .curve(d3.curveBasis)(points) ?? '',
      );

    // Main line — colour tracks the latest value
    const lineColor = currentR != null && currentR < 0 ? '#f87171' : '#60a5fa';

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', lineColor)
      .attr('stroke-width', 1.5)
      .attr(
        'd',
        d3.line<HistoryPoint>()
          .x((p, i) => xScale(dates[i]))
          .y(p => yScale(p.r))
          .curve(d3.curveBasis)(points) ?? '',
      );

    // Current r dot
    if (currentR != null) {
      const lastDate = dates[dates.length - 1];
      g.append('circle')
        .attr('cx', xScale(lastDate))
        .attr('cy', yScale(currentR))
        .attr('r', 4)
        .attr('fill', lineColor)
        .attr('stroke', '#0f1117')
        .attr('stroke-width', 1.5);
    }

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${iH})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(5)
          .tickFormat(d => {
            const dt = d as Date;
            return dates[dates.length - 1].getFullYear() - dates[0].getFullYear() > 0
              ? d3.timeFormat('%b %Y')(dt)
              : d3.timeFormat('%b %d')(dt);
          }),
      )
      .call(g2 => {
        g2.selectAll('text').attr('fill', '#64748b').attr('font-size', 9);
        g2.select('.domain').remove();
        g2.selectAll('.tick line').remove();
      });

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => (d as number).toFixed(1)))
      .call(g2 => {
        g2.selectAll('text').attr('fill', '#64748b').attr('font-size', 9);
        g2.select('.domain').remove();
        g2.selectAll('.tick line').attr('stroke', '#1e293b');
      });

    // r=0 label
    g.append('text')
      .attr('x', iW + 4)
      .attr('y', yScale(0) + 3)
      .attr('font-size', 8)
      .attr('fill', '#475569')
      .text('0');
  }, [points, currentR]);

  return (
    <div className="absolute bottom-4 left-4 z-20 w-[500px] rounded-lg border border-surface-border bg-surface shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border px-3 py-2">
        <div className="min-w-0">
          <span className="text-xs font-bold text-white">{aLabel}</span>
          <span className="mx-2 text-xs text-slate-500">vs</span>
          <span className="text-xs font-bold text-white">{bLabel}</span>
          {currentR != null && (
            <span
              className="ml-3 font-mono text-xs font-semibold"
              style={{ color: currentR >= 0 ? '#60a5fa' : '#f87171' }}
            >
              r = {currentR > 0 ? '+' : ''}{currentR.toFixed(3)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 flex-shrink-0 rounded p-0.5 text-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Chart */}
      <div className="p-3">
        <div className="mb-1.5 text-[10px] text-slate-600">
          {windowBars}-bar rolling Pearson r · click another cell to compare
        </div>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-slate-600">
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 19A9 9 0 104.583 9.582" />
            </svg>
            Loading history…
          </div>
        ) : points.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-xs text-slate-600">
            Not enough shared data for rolling history
          </div>
        ) : (
          <svg ref={svgRef} className="block w-full" />
        )}
      </div>
    </div>
  );
}
