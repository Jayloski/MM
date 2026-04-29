'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CorrelationResponse, AssetClass, WebNode, WebLink } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

interface Props {
  data: CorrelationResponse;
  threshold: number;
}

interface CorrelationRow {
  ticker: string;
  label: string;
  assetClass: AssetClass;
  subGroup: string;
  r: number;
}

interface PanelState {
  ticker: string;
  label: string;
  assetClass: AssetClass;
  rows: CorrelationRow[];
}

const CLASS_LABEL: Record<AssetClass, string> = {
  futures: 'Futures',
  forex: 'Forex',
};

export default function CorrelationWeb({ data, threshold }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<WebNode, WebLink> | null>(null);
  const [panel, setPanel] = useState<PanelState | null>(null);

  // Stable ref so the click callback can call setPanel without re-running the effect
  const onNodeClick = useRef<(d: WebNode) => void>(() => {});
  onNodeClick.current = (d: WebNode) => {
    const idx = data.tickers.indexOf(d.id);
    if (idx === -1) return;

    const rows: CorrelationRow[] = data.tickers
      .map((ticker, j) => {
        if (ticker === d.id) return null;
        const r = data.matrix[idx][j];
        if (r == null) return null;
        return {
          ticker,
          label: data.labels[ticker] ?? ticker,
          assetClass: data.assetClasses[ticker] as AssetClass,
          subGroup: data.subGroups[ticker] ?? '',
          r,
        } satisfies CorrelationRow;
      })
      .filter((x): x is CorrelationRow => x !== null)
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    setPanel({
      ticker: d.id,
      label: d.label,
      assetClass: d.assetClass,
      rows,
    });
  };

  useEffect(() => {
    if (!svgRef.current) return;

    simRef.current?.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth || 900;
    const height = svgRef.current.clientHeight || 600;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: WebNode[] = data.tickers.map(ticker => ({
      id: ticker,
      label: data.labels[ticker] ?? ticker,
      assetClass: data.assetClasses[ticker] as AssetClass,
      subGroup: data.subGroups[ticker],
    }));

    const n = data.tickers.length;
    const links: WebLink[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = data.matrix[i][j];
        if (r == null) continue;
        const absR = Math.abs(r);
        if (absR >= threshold) {
          links.push({ source: data.tickers[i], target: data.tickers[j], r, absR });
        }
      }
    }

    const edgeWidth   = d3.scaleLinear([threshold, 1], [0.5, 6]);
    const edgeOpacity = d3.scaleLinear([threshold, 1], [0.25, 0.85]);

    const container = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        .on('zoom', event => container.attr('transform', event.transform)),
    );

    // Click on background to dismiss panel
    svg.on('click', () => setPanel(null));

    const linkEl = container
      .append('g').attr('class', 'links')
      .selectAll<SVGLineElement, WebLink>('line')
      .data(links).join('line')
      .attr('stroke', d => (d.r > 0 ? '#60a5fa' : '#f87171'))
      .attr('stroke-width', d => edgeWidth(d.absR))
      .attr('stroke-opacity', d => edgeOpacity(d.absR));

    const nodeEl = container
      .append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, WebNode>('g')
      .data(nodes).join('g')
      .attr('cursor', 'grab');

    const radius = 16;

    nodeEl.append('circle')
      .attr('r', radius)
      .attr('fill', d => ASSET_CLASS_COLORS[d.assetClass] ?? '#888')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#0f1117')
      .attr('stroke-width', 1.5);

    nodeEl.append('text')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#0f1117')
      .attr('pointer-events', 'none')
      .text(d => d.label.slice(0, 7));

    nodeEl.append('title').text(d => d.label);

    // Track drag vs click
    let dragged = false;

    const drag = d3.drag<SVGGElement, WebNode>()
      .on('start', (event, d) => {
        dragged = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        document.body.style.cursor = 'grabbing';
      })
      .on('drag', (event, d) => {
        dragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        document.body.style.cursor = '';
      });

    nodeEl.call(drag as d3.DragBehavior<SVGGElement, WebNode, unknown>);

    // Click: open panel (ignore if this was a drag)
    nodeEl.on('click', (event, d) => {
      event.stopPropagation();
      if (!dragged) onNodeClick.current(d);
    });

    // Highlight connected nodes/edges on hover
    nodeEl
      .on('mouseenter', (_, hovered) => {
        const connectedIds = new Set<string>();
        links.forEach(l => {
          const s = (l.source as WebNode).id ?? l.source;
          const t = (l.target as WebNode).id ?? l.target;
          if (s === hovered.id) connectedIds.add(t as string);
          if (t === hovered.id) connectedIds.add(s as string);
        });
        nodeEl.select('circle')
          .attr('fill-opacity', (d: WebNode) =>
            d.id === hovered.id || connectedIds.has(d.id) ? 1 : 0.3,
          );
        linkEl
          .attr('stroke-opacity', (l: WebLink) => {
            const s = (l.source as WebNode).id;
            const t = (l.target as WebNode).id;
            return s === hovered.id || t === hovered.id
              ? edgeOpacity(l.absR) * 1.5
              : 0.05;
          });
      })
      .on('mouseleave', () => {
        nodeEl.select('circle').attr('fill-opacity', 0.9);
        linkEl.attr('stroke-opacity', (d: WebLink) => edgeOpacity(d.absR));
      });

    const simulation = d3
      .forceSimulation<WebNode>(nodes)
      .force('link', d3.forceLink<WebNode, WebLink>(links)
        .id(d => d.id)
        .distance(d => 140 - d.absR * 70)
        .strength(d => d.absR * 0.25))
      .force('charge', d3.forceManyBody<WebNode>().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<WebNode>(radius + 6))
      .alphaDecay(0.025);

    simRef.current = simulation;

    simulation.on('tick', () => {
      linkEl
        .attr('x1', d => (d.source as WebNode).x ?? 0)
        .attr('y1', d => (d.source as WebNode).y ?? 0)
        .attr('x2', d => (d.target as WebNode).x ?? 0)
        .attr('y2', d => (d.target as WebNode).y ?? 0);
      nodeEl.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Legend
    const legend = svg.append('g').attr('transform', 'translate(16,16)');
    ([['futures', 'Futures'], ['forex', 'Forex']] as [AssetClass, string][]).forEach(([cls, lbl], i) => {
      const row = legend.append('g').attr('transform', `translate(0,${i * 20})`);
      row.append('circle').attr('r', 6).attr('cy', 6).attr('fill', ASSET_CLASS_COLORS[cls]);
      row.append('text').attr('x', 14).attr('y', 10).attr('font-size', 11).attr('fill', '#94a3b8').text(lbl);
    });
    const edgeLeg = svg.append('g').attr('transform', 'translate(16,60)');
    ([['#60a5fa', 'Positive r'], ['#f87171', 'Negative r']] as [string, string][]).forEach(([color, lbl], i) => {
      const row = edgeLeg.append('g').attr('transform', `translate(0,${i * 18})`);
      row.append('line').attr('x2', 16).attr('y1', 6).attr('y2', 6).attr('stroke', color).attr('stroke-width', 2.5);
      row.append('text').attr('x', 22).attr('y', 10).attr('font-size', 11).attr('fill', '#94a3b8').text(lbl);
    });

    return () => { simulation.stop(); };
  }, [data, threshold]);

  return (
    <div className="relative w-full rounded-lg border border-surface-border bg-surface-raised">
      <svg ref={svgRef} className="block h-[600px] w-full" />

      {/* Correlation detail panel */}
      {panel && (
        <div className="absolute bottom-4 right-4 z-20 w-72 rounded-lg border border-surface-border bg-surface shadow-2xl">
          {/* Header */}
          <div
            className="flex items-center justify-between rounded-t-lg px-3 py-2"
            style={{ backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '22',
                     borderBottom: `1px solid ${ASSET_CLASS_COLORS[panel.assetClass]}44` }}
          >
            <div>
              <span className="text-xs font-bold text-white">{panel.label}</span>
              <span
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '33',
                         color: ASSET_CLASS_COLORS[panel.assetClass] }}
              >
                {CLASS_LABEL[panel.assetClass]}
              </span>
            </div>
            <button
              onClick={() => setPanel(null)}
              className="ml-2 rounded p-0.5 text-slate-500 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Row list */}
          <div className="max-h-80 overflow-y-auto py-1">
            {panel.rows.map(row => {
              const isPos = row.r >= 0;
              const barW  = Math.abs(row.r) * 100;
              const barColor = isPos ? '#60a5fa' : '#f87171';
              return (
                <div key={row.ticker} className="group flex items-center gap-2 px-3 py-1.5 hover:bg-white/5">
                  {/* Asset class dot */}
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: ASSET_CLASS_COLORS[row.assetClass] }}
                  />
                  {/* Label + subgroup */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-slate-200">{row.label}</div>
                    <div className="text-[10px] text-slate-600">
                      {SUBGROUP_LABELS[row.subGroup as keyof typeof SUBGROUP_LABELS] ?? row.subGroup}
                    </div>
                  </div>
                  {/* Bar + r value */}
                  <div className="flex w-24 flex-shrink-0 flex-col items-end gap-0.5">
                    <span
                      className="font-mono text-xs font-semibold"
                      style={{ color: barColor }}
                    >
                      {row.r > 0 ? '+' : ''}{row.r.toFixed(3)}
                    </span>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-border">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${barW}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-b-lg border-t border-surface-border px-3 py-1.5 text-[10px] text-slate-600">
            {panel.rows.length} correlations · click background to dismiss
          </div>
        </div>
      )}
    </div>
  );
}
