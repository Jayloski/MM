'use client';

import { useEffect, useState } from 'react';

// Sessions defined as UTC hour ranges; displayed in CT (America/Chicago)
const SESSIONS = [
  { name: 'Asian',    utcStart: 0,  utcEnd: 9,  color: 'rgba(251,191,36,0.18)',  activeColor: 'rgba(251,191,36,0.38)',  dot: '#fbbf24', textColor: 'text-amber-400'   },
  { name: 'London',  utcStart: 7,  utcEnd: 16, color: 'rgba(96,165,250,0.18)',  activeColor: 'rgba(96,165,250,0.38)',  dot: '#60a5fa', textColor: 'text-blue-400'    },
  { name: 'New York',utcStart: 13, utcEnd: 22, color: 'rgba(52,211,153,0.18)', activeColor: 'rgba(52,211,153,0.38)', dot: '#34d399', textColor: 'text-emerald-400' },
] as const;

const HOUR_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

function getCTMinutes(date: Date): number {
  // Use Intl to get the current hour/minute in America/Chicago (handles DST)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
  // handle midnight edge: Intl may return hour 24
  return ((h === 24 ? 0 : h) * 60) + m;
}

function utcToCtMinutes(utcHour: number, date: Date): number {
  // Get CT UTC offset in minutes
  const utcMs = Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(),
    utcHour, 0, 0,
  );
  const ctDate = new Date(utcMs);
  const ctMins = getCTMinutes(ctDate);
  // ctMins = ctHour*60+ctMin; but we need minute offset from CT midnight
  return ctMins;
}

function formatCT(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

interface SessionBand {
  name: string;
  startPct: number; // pct from left
  widthPct: number;
  color: string;
  activeColor: string;
  dot: string;
  textColor: string;
  isActive: boolean;
  wraps: boolean; // does the band cross midnight CT?
}

function computeBands(now: Date): { bands: SessionBand[]; nowPct: number } {
  const nowCT = getCTMinutes(now);
  const nowPct = (nowCT / 1440) * 100;

  const bands: SessionBand[] = SESSIONS.map(s => {
    const startCT = utcToCtMinutes(s.utcStart, now);
    const endCT   = utcToCtMinutes(s.utcEnd, now);

    const durationMins = (s.utcEnd - s.utcStart) * 60;
    const wraps = endCT < startCT; // crosses midnight in CT

    let isActive: boolean;
    if (wraps) {
      isActive = nowCT >= startCT || nowCT < endCT;
    } else {
      isActive = nowCT >= startCT && nowCT < endCT;
    }

    const startPct = (startCT / 1440) * 100;
    const widthPct = (durationMins / 1440) * 100;

    return {
      name: s.name,
      startPct,
      widthPct,
      color: s.color,
      activeColor: s.activeColor,
      dot: s.dot,
      textColor: s.textColor,
      isActive,
      wraps,
    };
  });

  return { bands, nowPct };
}

interface Props {
  fetchedAt: string;
}

export default function SessionTimeline({ fetchedAt }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const date = now ?? new Date(fetchedAt);
  const { bands, nowPct } = computeBands(date);
  const activeBands = bands.filter(b => b.isActive);

  return (
    <section className="rounded-lg border border-surface-border bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Trading Sessions
        </h2>
        <span className="font-mono text-xs text-slate-400">
          {formatCT(date)} CT
        </span>
      </div>

      {/* Session bar */}
      <div className="relative h-9 overflow-hidden rounded bg-surface">
        {/* Hour ticks */}
        {HOUR_TICKS.map(h => (
          <div
            key={h}
            className="absolute top-0 bottom-0 w-px bg-surface-border/40"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}

        {/* Session bands */}
        {bands.map(b => {
          const bg = b.isActive ? b.activeColor : b.color;
          if (b.wraps) {
            // Render two segments: startPct→100% and 0→endPct
            const endPct = b.startPct + b.widthPct - 100;
            return (
              <>
                <div
                  key={`${b.name}-a`}
                  className="absolute top-0 bottom-0 transition-colors duration-500"
                  style={{ left: `${b.startPct}%`, width: `${100 - b.startPct}%`, background: bg }}
                />
                <div
                  key={`${b.name}-b`}
                  className="absolute top-0 bottom-0 transition-colors duration-500"
                  style={{ left: 0, width: `${endPct}%`, background: bg }}
                />
              </>
            );
          }
          return (
            <div
              key={b.name}
              className="absolute top-0 bottom-0 transition-colors duration-500"
              style={{ left: `${b.startPct}%`, width: `${b.widthPct}%`, background: bg }}
            />
          );
        })}

        {/* Now marker — only render client-side to avoid hydration mismatch */}
        {now && (
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-white/75"
            style={{ left: `${nowPct}%` }}
          >
            <div className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-white" />
          </div>
        )}
      </div>

      {/* Hour labels */}
      <div className="relative mt-1 h-4">
        {HOUR_TICKS.map(h => (
          <span
            key={h}
            className="absolute -translate-x-1/2 font-mono text-[9px] text-slate-600"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
          </span>
        ))}
      </div>

      {/* Active session badges */}
      <div className="mt-2 flex flex-wrap gap-3">
        {bands.map(b => (
          <span
            key={b.name}
            className={`flex items-center gap-1.5 font-mono text-xs transition-opacity ${b.isActive ? 'opacity-100' : 'opacity-30'}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: b.dot }}
            />
            <span className={b.isActive ? b.textColor : 'text-slate-500'}>
              {b.name}{b.isActive ? ' · active' : ''}
            </span>
          </span>
        ))}
        {activeBands.length === 0 && (
          <span className="font-mono text-xs text-slate-600">No major session active</span>
        )}
      </div>
    </section>
  );
}
