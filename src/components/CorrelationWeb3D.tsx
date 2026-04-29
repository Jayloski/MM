'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CorrelationResponse, AssetClass } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

interface Props {
  data: CorrelationResponse;
  threshold: number;
}

interface Node3D {
  id: string;
  label: string;
  assetClass: AssetClass;
  subGroup: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

interface Link3D { si: number; ti: number; r: number; absR: number }

interface PanelRow {
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
  rows: PanelRow[];
}

interface HoverTip { x: number; y: number; label: string; assetClass: AssetClass }

const CLASS_LABEL: Record<AssetClass, string> = { futures: 'Futures', forex: 'Forex' };

function hexToInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

export default function CorrelationWeb3D({ data, threshold }: Props) {
  const mountRef    = useRef<HTMLDivElement>(null);
  const [panel, setPanel]         = useState<PanelState | null>(null);
  const [hoverTip, setHoverTip]   = useState<HoverTip | null>(null);

  const openPanel = useCallback(
    (nodeId: string) => {
      const idx = data.tickers.indexOf(nodeId);
      if (idx === -1) { setPanel(null); return; }
      const rows: PanelRow[] = data.tickers
        .map((ticker, j) => {
          if (ticker === nodeId) return null;
          const r = data.matrix[idx][j];
          if (r == null) return null;
          return {
            ticker,
            label: data.labels[ticker] ?? ticker,
            assetClass: data.assetClasses[ticker] as AssetClass,
            subGroup: data.subGroups[ticker] ?? '',
            r,
          };
        })
        .filter((x): x is PanelRow => x !== null)
        .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
      setPanel({
        ticker: nodeId,
        label: data.labels[nodeId] ?? nodeId,
        assetClass: data.assetClasses[nodeId] as AssetClass,
        rows,
      });
    },
    [data],
  );

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let rafId = 0;
    let disposed = false;

    // Camera + drag state hoisted so mouseMoveGlobal can close over them
    let camRadius = 480;
    let camTheta  = 0;
    let camPhi    = Math.PI / 3;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    // Set to real updateCamera once Three.js loads
    const cb = { updateCamera: () => {} };

    const mouseMoveGlobal = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      camTheta -= dx * 0.007;
      camPhi = Math.max(0.15, Math.min(Math.PI - 0.15, camPhi + dy * 0.007));
      lastX = e.clientX;
      lastY = e.clientY;
      cb.updateCamera();
    };
    const mouseUpGlobal = () => { isDragging = false; };

    (async () => {
      const THREE = await import('three');
      if (disposed) return;

      const W = container.clientWidth || 900;
      const H = 600;

      // ── Nodes ─────────────────────────────────────────────────────────
      const nodes: Node3D[] = data.tickers.map((ticker, i) => {
        const phi   = Math.acos(2 * (i / Math.max(1, data.tickers.length - 1)) - 1);
        const theta = Math.sqrt(data.tickers.length * Math.PI) * phi;
        const r     = 160;
        return {
          id: ticker,
          label: data.labels[ticker] ?? ticker,
          assetClass: data.assetClasses[ticker] as AssetClass,
          subGroup: data.subGroups[ticker] ?? '',
          x: r * Math.sin(phi) * Math.cos(theta) + (Math.random() - 0.5) * 10,
          y: r * Math.cos(phi) + (Math.random() - 0.5) * 10,
          z: r * Math.sin(phi) * Math.sin(theta) + (Math.random() - 0.5) * 10,
          vx: 0, vy: 0, vz: 0,
        };
      });

      // ── Links ─────────────────────────────────────────────────────────
      const links: Link3D[] = [];
      for (let i = 0; i < data.tickers.length; i++) {
        for (let j = i + 1; j < data.tickers.length; j++) {
          const r = data.matrix[i][j];
          if (r == null) continue;
          const absR = Math.abs(r);
          if (absR >= threshold) links.push({ si: i, ti: j, r, absR });
        }
      }

      // ── Three.js scene ────────────────────────────────────────────────
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0f1117);

      const camera  = new THREE.PerspectiveCamera(55, W / H, 1, 5000);

      function updateCamera() {
        camera.position.set(
          camRadius * Math.sin(camPhi) * Math.cos(camTheta),
          camRadius * Math.cos(camPhi),
          camRadius * Math.sin(camPhi) * Math.sin(camTheta),
        );
        camera.lookAt(0, 0, 0);
      }
      cb.updateCamera = updateCamera;
      updateCamera();

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      const canvas = renderer.domElement;

      // Lights
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      const dl = new THREE.DirectionalLight(0xffffff, 0.9);
      dl.position.set(1, 2, 1);
      scene.add(dl);

      // ── Node meshes ───────────────────────────────────────────────────
      const nodeGeo = new THREE.SphereGeometry(9, 16, 12);
      const nodeMeshes = nodes.map(n => {
        const mesh = new THREE.Mesh(
          nodeGeo,
          new THREE.MeshLambertMaterial({ color: hexToInt(ASSET_CLASS_COLORS[n.assetClass] ?? '#888888') }),
        );
        mesh.userData.nodeId = n.id;
        scene.add(mesh);
        return mesh;
      });

      // ── Edge LineSegments ─────────────────────────────────────────────
      const posArr = new Float32Array(links.length * 2 * 3);
      const colArr = new Float32Array(links.length * 2 * 3);

      links.forEach((l, i) => {
        // colour by sign, brightness by |r|
        const opacity = 0.2 + l.absR * 0.7;
        const [cr, cg, cb] = l.r > 0
          ? [0x60 / 255, 0xa5 / 255, 0xfa / 255]  // blue
          : [0xf8 / 255, 0x71 / 255, 0x71 / 255];  // red
        for (let v = 0; v < 2; v++) {
          colArr[i * 6 + v * 3]     = cr * opacity;
          colArr[i * 6 + v * 3 + 1] = cg * opacity;
          colArr[i * 6 + v * 3 + 2] = cb * opacity;
        }
      });

      const edgeGeo   = new THREE.BufferGeometry();
      const posBuf    = new THREE.BufferAttribute(posArr, 3);
      posBuf.setUsage(THREE.DynamicDrawUsage);
      edgeGeo.setAttribute('position', posBuf);
      edgeGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
      scene.add(new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ vertexColors: true })));

      // ── Raycaster ────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const tmpMouse  = new THREE.Vector2();

      function getHit(clientX: number, clientY: number) {
        const rect = canvas.getBoundingClientRect();
        tmpMouse.set(
          ((clientX - rect.left) / W) * 2 - 1,
          -((clientY - rect.top) / H) * 2 + 1,
        );
        raycaster.setFromCamera(tmpMouse, camera);
        const hits = raycaster.intersectObjects(nodeMeshes);
        return hits.length > 0 ? (hits[0].object.userData.nodeId as string) : null;
      }

      // ── Mouse events ─────────────────────────────────────────────────
      canvas.addEventListener('mousedown', e => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });

      canvas.addEventListener('click', e => {
        const nodeId = getHit(e.clientX, e.clientY);
        if (nodeId) openPanel(nodeId);
        else        setPanel(null);
      });

      canvas.addEventListener('mousemove', e => {
        if (isDragging) { setHoverTip(null); return; }
        const nodeId = getHit(e.clientX, e.clientY);
        if (nodeId) {
          const rect = canvas.getBoundingClientRect();
          setHoverTip({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            label: data.labels[nodeId] ?? nodeId,
            assetClass: data.assetClasses[nodeId] as AssetClass,
          });
        } else {
          setHoverTip(null);
        }
      });

      canvas.addEventListener('mouseleave', () => setHoverTip(null));

      canvas.addEventListener('wheel', e => {
        camRadius = Math.max(150, Math.min(1000, camRadius + e.deltaY * 0.5));
        updateCamera();
        e.preventDefault();
      }, { passive: false });

      window.addEventListener('mousemove', mouseMoveGlobal);
      window.addEventListener('mouseup', mouseUpGlobal);

      // ── Force simulation ──────────────────────────────────────────────
      let alpha = 1.0;
      const ALPHA_DECAY = 0.016;
      const REPULSION   = 16000;
      const DAMPING     = 0.86;

      function simTick() {
        if (alpha < 0.002) return;
        alpha *= 1 - ALPHA_DECAY;
        const a = alpha;

        // Repulsion (all pairs)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const ni = nodes[i], nj = nodes[j];
            const dx = nj.x - ni.x, dy = nj.y - ni.y, dz = nj.z - ni.z;
            const d2 = dx*dx + dy*dy + dz*dz + 1;
            const d  = Math.sqrt(d2);
            const f  = REPULSION * a / d2;
            ni.vx -= dx/d*f; ni.vy -= dy/d*f; ni.vz -= dz/d*f;
            nj.vx += dx/d*f; nj.vy += dy/d*f; nj.vz += dz/d*f;
          }
        }

        // Attraction (edges)
        for (const l of links) {
          const ni = nodes[l.si], nj = nodes[l.ti];
          const dx = nj.x - ni.x, dy = nj.y - ni.y, dz = nj.z - ni.z;
          const d  = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
          const rest   = 110 - l.absR * 55;
          const stretch = (d - rest) / d;
          const str    = l.absR * 0.45 * a;
          ni.vx += dx*stretch*str; ni.vy += dy*stretch*str; ni.vz += dz*stretch*str;
          nj.vx -= dx*stretch*str; nj.vy -= dy*stretch*str; nj.vz -= dz*stretch*str;
        }

        // Centering
        let cx = 0, cy = 0, cz = 0;
        for (const n of nodes) { cx += n.x; cy += n.y; cz += n.z; }
        cx /= nodes.length; cy /= nodes.length; cz /= nodes.length;
        const cs = 0.06 * a;
        for (const n of nodes) {
          n.vx -= cx*cs; n.vy -= cy*cs; n.vz -= cz*cs;
          n.vx *= DAMPING; n.vy *= DAMPING; n.vz *= DAMPING;
          n.x  += n.vx;   n.y  += n.vy;   n.z  += n.vz;
        }
      }

      // ── Render loop ───────────────────────────────────────────────────
      function animate() {
        rafId = requestAnimationFrame(animate);
        const ticks = alpha > 0.1 ? 4 : 1;
        for (let t = 0; t < ticks; t++) simTick();

        nodes.forEach((n, i) => nodeMeshes[i].position.set(n.x, n.y, n.z));

        links.forEach((l, i) => {
          const s = nodes[l.si], t = nodes[l.ti];
          posArr[i*6]   = s.x; posArr[i*6+1] = s.y; posArr[i*6+2] = s.z;
          posArr[i*6+3] = t.x; posArr[i*6+4] = t.y; posArr[i*6+5] = t.z;
        });
        posBuf.needsUpdate = true;

        renderer.render(scene, camera);
      }
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', mouseMoveGlobal);
      window.removeEventListener('mouseup', mouseUpGlobal);
      // Remove canvas if still mounted
      if (mountRef.current) {
        const cv = mountRef.current.querySelector('canvas');
        if (cv) mountRef.current.removeChild(cv);
      }
    };
  }, [data, threshold, openPanel]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-surface-border bg-surface-raised"
      style={{ height: 600 }}
    >
      <div ref={mountRef} className="h-full w-full" />

      {/* Hover tooltip */}
      {hoverTip && (
        <div
          className="pointer-events-none absolute z-10 rounded border border-surface-border bg-surface px-2 py-1 text-xs shadow-lg"
          style={{ left: hoverTip.x + 12, top: hoverTip.y - 8 }}
        >
          <span className="font-semibold text-white">{hoverTip.label}</span>
          <span className="ml-2 text-slate-500">{CLASS_LABEL[hoverTip.assetClass]}</span>
        </div>
      )}

      {/* Legend */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
        {(['futures', 'forex'] as AssetClass[]).map(cls => (
          <div key={cls} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ASSET_CLASS_COLORS[cls] }} />
            <span className="text-[11px] text-slate-400">{CLASS_LABEL[cls]}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center gap-2">
          <span className="block h-0.5 w-4 bg-blue-400" />
          <span className="text-[11px] text-slate-400">Positive r</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="block h-0.5 w-4 bg-red-400" />
          <span className="text-[11px] text-slate-400">Negative r</span>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-slate-700">
        drag to orbit · scroll to zoom · click node for details
      </div>

      {/* Correlation detail panel */}
      {panel && (
        <div className="absolute bottom-4 right-4 z-20 w-72 rounded-lg border border-surface-border bg-surface shadow-2xl">
          <div
            className="flex items-center justify-between rounded-t-lg px-3 py-2"
            style={{
              backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '22',
              borderBottom: `1px solid ${ASSET_CLASS_COLORS[panel.assetClass]}44`,
            }}
          >
            <div>
              <span className="text-xs font-bold text-white">{panel.label}</span>
              <span
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  backgroundColor: ASSET_CLASS_COLORS[panel.assetClass] + '33',
                  color: ASSET_CLASS_COLORS[panel.assetClass],
                }}
              >
                {CLASS_LABEL[panel.assetClass]}
              </span>
            </div>
            <button
              onClick={() => setPanel(null)}
              className="ml-2 rounded p-0.5 text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {panel.rows.map(row => {
              const barColor = row.r >= 0 ? '#60a5fa' : '#f87171';
              return (
                <div key={row.ticker} className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5">
                  <span
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: ASSET_CLASS_COLORS[row.assetClass] }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs text-slate-200">{row.label}</div>
                    <div className="text-[10px] text-slate-600">
                      {SUBGROUP_LABELS[row.subGroup as keyof typeof SUBGROUP_LABELS] ?? row.subGroup}
                    </div>
                  </div>
                  <div className="flex w-24 flex-shrink-0 flex-col items-end gap-0.5">
                    <span className="font-mono text-xs font-semibold" style={{ color: barColor }}>
                      {row.r > 0 ? '+' : ''}{row.r.toFixed(3)}
                    </span>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-border">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.abs(row.r) * 100}%`, backgroundColor: barColor }}
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
