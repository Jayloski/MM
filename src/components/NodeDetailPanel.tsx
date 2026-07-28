'use client';

import type { CorrelationResponse, SessionName, VolatilityProfile } from '@/types';
import { ASSET_CLASS_COLORS, SUBGROUP_LABELS } from '@/lib/assets';

interface Props {
  ticker: string | null;
  data: CorrelationResponse;
  onClose: () => void;
  onCorrelationClick: (ticker: string) => void;
}

const SESSION_STYLES: Record<SessionName, string> = {
  'Asian':         'bg-purple-950 text-purple-300 border border-purple-700',
  'European':      'bg-blue-950 text-blue-300 border border-blue-700',
  'US':            'bg-green-950 text-green-300 border border-green-700',
  'EU/US Overlap': 'bg-teal-950 text-teal-300 border border-teal-700',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTopCorrelations(ticker: string, data: CorrelationResponse) {
  const idx = data.tickers.indexOf(ticker);
  if (idx === -1) return { positive: [], negative: [] };
  const row = data.matrix[idx];
  const sorted = data.tickers
    .map((t, i) => ({ ticker: t, label: data.labels[t] ?? t, r: row[i] ?? NaN }))
    .filter(x => x.ticker !== ticker && isFinite(x.r))
    .sort((a, b) => b.r - a.r);
  return {
    positive: sorted.slice(0, 5),
    negative: [...sorted].reverse().slice(0, 5),
  };
}

function ProfileChart({
  values,
  labels,
  activeIndex,
  unit,
  title,
}: {
  values: number[];
  labels: string[];
  activeIndex: number;
  unit: string;
  title: string;
}) {
  const max = Math.max(...values, 0.0001);
  const H = 40;
  const barW = Math.floor(220 / values.length) - 1;
  const gap = Math.floor(220 / values.length) - barW;

  // Only show a subset of x-axis labels to avoid crowding
  const showLabel = (i: number) => {
    if (values.length <= 7) return true;
    return i === 0 || i === 6 || i === 12 || i === 18 || i === values.length - 1;
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <span className="font-mono text-[10px] text-slate-600">{unit}</span>
      </div>
      <svg viewBox={`0 0 220 ${H + 14}`} className="w-full" style={{ height: H + 14 }}>
        {values.map((v, i) => {
          const barH = max > 0 ? Math.max((v / max) * H, v > 0 ? 1 : 0) : 0;
          const x = i * (barW + gap);
          const isActive = i === activeIndex;
          return (
            <g key={i}>
              <rect
                x={x}
                y={H - barH}
                width={barW}
                height={barH}
                fill={isActive ? '#f59e0b' : '#475569'}
                opacity={v === 0 ? 0.3 : 1}
              />
              {showLabel(i) && (
                <text
                  x={x + barW / 2}
                  y={H + 11}
                  textAnchor="middle"
                  fontSize={7}
                  fill={isActive ? '#f59e0b' : '#64748b'}
                >
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
        {/* Max value label */}
        <text x={219} y={8} textAnchor="end" fontSize={7} fill="#475569">
          {max >= 10 ? max.toFixed(1) : max.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}

function VolatilityProfileSection({
  profile,
  vol,
}: {
  profile: VolatilityProfile;
  vol: number | undefined;
}) {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay  = now.getUTCDay();

  const hourLabels = Array.from({ length: 24 }, (_, i) => String(i));
  // Only show Mon–Fri (indices 1–5), skip Sun(0) and Sat(6)
  const weekdayValues = profile.daily.slice(1, 6);
  const weekdayLabels = DAY_LABELS.slice(1, 6);
  const activeDay = currentDay >= 1 && currentDay <= 5 ? currentDay - 1 : -1;

  const dailyMove = vol != null ? (vol / Math.sqrt(252)) * 100 : null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Volatility Profile</p>

      <ProfileChart
        values={profile.hourly}
        labels={hourLabels}
        activeIndex={currentHour}
        unit={`${profile.unit}/hr (UTC)`}
        title="Hour of Day"
      />

      <ProfileChart
        values={weekdayValues}
        labels={weekdayLabels}
        activeIndex={activeDay}
        unit={`${profile.unit}/day`}
        title="Day of Week"
      />

      {dailyMove != null && (
        <div className="font-mono text-[10px] text-slate-600">
          ~{dailyMove.toFixed(2)}% avg daily move (annualised stddev basis)
        </div>
      )}
    </div>
  );
}

export default function NodeDetailPanel({ ticker, data, onClose, onCorrelationClick }: Props) {
  const isOpen = ticker !== null;

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-lg border border-surface-border bg-surface-raised transition-all duration-200 ${
        isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <span className="truncate font-semibold text-white text-sm">
          {ticker ? (data.labels[ticker] ?? ticker) : ''}
        </span>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 text-slate-500 transition-colors hover:text-white text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {ticker && (() => {
        const assetClass = data.assetClasses[ticker];
        const subGroup = data.subGroups[ticker];
        const sessions = data.sessions?.[ticker] ?? [];
        const vol = data.volatility?.[ticker];
        const profile = data.volatilityProfiles?.[ticker];
        const { positive, negative } = getTopCorrelations(ticker, data);
        const classColor = ASSET_CLASS_COLORS[assetClass] ?? '#888';

        return (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: classColor + '22', color: classColor, border: `1px solid ${classColor}55` }}
              >
                {assetClass === 'futures' ? 'Futures' : 'Forex'}
              </span>
              <span className="rounded border border-slate-600 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                {SUBGROUP_LABELS[subGroup] ?? subGroup}
              </span>
              <span className="font-mono text-xs text-slate-500">{ticker}</span>
            </div>

            {/* Sessions */}
            {sessions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Active Sessions (CT)</p>
                <div className="flex flex-wrap gap-2">
                  {sessions.map((s, i) => (
                    <div key={i} className={`rounded-md px-2.5 py-1.5 text-xs leading-tight ${SESSION_STYLES[s.name]}`}>
                      <div className="font-semibold">{s.name}</div>
                      <div className="mt-0.5 font-mono opacity-80">{s.startCT} – {s.endCT}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Volatility Profile */}
            {profile && (
              <VolatilityProfileSection profile={profile} vol={vol} />
            )}

            {/* Top Correlations */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Top Correlations</p>

              {positive.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-xs text-slate-600">Positive</p>
                  <div className="space-y-1">
                    {positive.map(({ ticker: t, label: lbl, r }) => (
                      <button
                        key={t}
                        onClick={() => onCorrelationClick(t)}
                        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-white/5 transition-colors group"
                      >
                        <span className="w-20 truncate text-xs text-slate-400 group-hover:text-white transition-colors" title={lbl}>{lbl}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.abs(r) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-slate-300">+{r.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {negative.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs text-slate-600">Negative</p>
                  <div className="space-y-1">
                    {negative.map(({ ticker: t, label: lbl, r }) => (
                      <button
                        key={t}
                        onClick={() => onCorrelationClick(t)}
                        className="flex w-full items-center gap-2 rounded px-1 py-1 text-left hover:bg-white/5 transition-colors group"
                      >
                        <span className="w-20 truncate text-xs text-slate-400 group-hover:text-white transition-colors" title={lbl}>{lbl}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.abs(r) * 100}%` }} />
                        </div>
                        <span className="w-10 text-right font-mono text-xs text-slate-300">{r.toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
