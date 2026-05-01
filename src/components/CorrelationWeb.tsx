'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { CorrelationResponse, AssetClass, WebNode, WebLink } from '@/types';
import { ASSET_CLASS_COLORS } from '@/lib/assets';
import AssetDetailPanel from './AssetDetailPanel';

interface Props {
  data: CorrelationResponse;
  threshold: number;
}

export default function CorrelationWeb({ data, threshold }: Props) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const simRef    = useRef<d3.Simulation<WebNode, WebLink> | null>(null);
  const nodeElRef = useRef<d3.Selection<SVGGElement, WebNode, SVGGElement, unknown> | null>(null);
  const onClickRef = useRef<(id: string) => void>(() => {});

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Keep click handler ref fresh so D3 closure never goes stale
  onClickRef.current = setSelectedId;

  const handleCorrelationClick = useCallback((id: string) => setSelectedId(id), []);

  // Main simulation — only rebuilds when data or threshold changes
  useEffect(() => {
    if (!svgRef.current) return;

    simRef.current?.stop();

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width  = svgRef.current.clientWidth  || 900;
    const height = svgRef.current.clientHeight || 600;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const nodes: WebNode[] = data.tickers.map(ticker => ({
      id: ticker,
      label: data.labels[ticker] ?? ticker,
      assetClass: data.assetClasses[ticker] as AssetClass,
      subGroup: data.subGroups[ticker],
    }));

    const links: WebLink[] = [];
    const n = data.tickers.length;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const r = data.matrix[i][j];
        if (r == null) continue;
        const absR = Math.abs(r);
        if (absR >= threshold) links.push({ source: data.tickers[i], target: data.tickers[j], r, absR });
      }
    }

    const edgeWidth   = d3.scaleLinear([threshold, 1], [0.5, 6]);
    const edgeOpacity = d3.scaleLinear([threshold, 1], [0.25, 0.85]);

    const container = svg.append('g');
    svg.call(
      d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', ev => {
        container.attr('transform', ev.transform);
      }),
    );

    const linkEl = container
      .append('g').attr('class', 'links')
      .selectAll<SVGLineElement, WebLink>('line')
      .data(links).join('line')
      .attr('stroke', d => (d.r > 0 ? '#60a5fa' : '#f87171'))
      .attr('stroke-width', d => edgeWidth(d.absR))
      .attr('stroke-opacity', d => edgeOpacity(d.absR));

    const radius = 16;

    const nodeEl = container
      .append('g').attr('class', 'nodes')
      .selectAll<SVGGElement, WebNode>('g')
      .data(nodes).join('g')
      .attr('cursor', 'grab');

    nodeElRef.current = nodeEl;

    nodeEl.append('circle')
      .attr('r', radius)
      .attr('fill', d => ASSET_CLASS_COLORS[d.assetClass] ?? '#888')
      .attr('fill-opacity', 0.9)
      .attr('stroke', '#0f1117')
      .attr('stroke-width', 1.5);

    nodeEl.append('text')
      .attr('dy', '0.35em').attr('text-anchor', 'middle')
      .attr('font-size', 7).attr('font-family', 'ui-monospace, monospace')
      .attr('fill', '#0f1117').attr('pointer-events', 'none')
      .text(d => d.label.slice(0, 7));

    nodeEl.append('title').text(d => d.label);

    // Track whether pointer moved so click doesn't fire after drag
    let wasDragged = false;

    const drag = d3
      .drag<SVGGElement, WebNode>()
      .on('start', (event, d) => {
        wasDragged = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        wasDragged = true;
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    nodeEl.call(drag as d3.DragBehavior<SVGGElement, WebNode, unknown>);

    nodeEl.on('click', (_event, d) => {
      if (wasDragged) return;
      onClickRef.current(d.id);
    });

    const simulation = d3
      .forceSimulation<WebNode>(nodes)
      .force('link', d3.forceLink<WebNode, WebLink>(links).id(d => d.id)
        .distance(d => 140 - d.absR * 70).strength(d => d.absR * 0.25))
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
    ([{ cls: 'futures', label: 'Futures' }, { cls: 'forex', label: 'Forex' }] as { cls: AssetClass; label: string }[])
      .forEach(({ cls, label }, i) => {
        const row = legend.append('g').attr('transform', `translate(0,${i * 20})`);
        row.append('circle').attr('r', 6).attr('cy', 6).attr('fill', ASSET_CLASS_COLORS[cls]);
        row.append('text').attr('x', 14).attr('y', 10).attr('font-size', 11).attr('fill', '#94a3b8').text(label);
      });

    const edgeLegend = svg.append('g').attr('transform', 'translate(16,60)');
    ([{ color: '#60a5fa', label: 'Positive r' }, { color: '#f87171', label: 'Negative r' }])
      .forEach(({ color, label }, i) => {
        const row = edgeLegend.append('g').attr('transform', `translate(0,${i * 18})`);
        row.append('line').attr('x2', 16).attr('y1', 6).attr('y2', 6).attr('stroke', color).attr('stroke-width', 2.5);
        row.append('text').attr('x', 22).attr('y', 10).attr('font-size', 11).attr('fill', '#94a3b8').text(label);
      });

    return () => { simulation.stop(); };
  }, [data, threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight selected node without restarting the simulation
  useEffect(() => {
    const nodeEl = nodeElRef.current;
    if (!nodeEl) return;
    const radius = 16;
    nodeEl.select('circle')
      .attr('r',            (d: WebNode) => d.id === selectedId ? radius + 4 : radius)
      .attr('stroke',       (d: WebNode) => d.id === selectedId ? '#ffffff'  : '#0f1117')
      .attr('stroke-width', (d: WebNode) => d.id === selectedId ? 2.5        : 1.5);
  }, [selectedId]);

  return (
    <div className="flex gap-3">
      {/* Graph */}
      <div className={`rounded-lg border border-surface-border bg-surface-raised transition-all ${selectedId ? 'flex-1' : 'w-full'}`}>
        <svg
          ref={svgRef}
          className="block h-[600px] w-full"
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Asset detail panel */}
      {selectedId && (
        <AssetDetailPanel
          ticker={selectedId}
          data={data}
          onClose={() => setSelectedId(null)}
          onCorrelationClick={handleCorrelationClick}
        />
      )}
    </div>
  );
}
