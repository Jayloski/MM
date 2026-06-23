'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CorrelationResponse } from '@/types';

interface Props {
  data?: CorrelationResponse | null;
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/',          label: 'Correlation' },
];

export default function Navbar({ data }: Props) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-surface-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-bold tracking-widest text-white uppercase">
            Intermarket Correlation
          </span>

          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(link => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded px-3 py-1 font-mono text-xs transition-colors ${
                    active
                      ? 'bg-surface-border text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {data && (
            <span className="rounded bg-surface-border px-2 py-0.5 text-xs text-slate-500">
              {data.tickers.length} instruments
            </span>
          )}
        </div>

        {data && (
          <span className="text-xs text-slate-600">
            Updated {new Date(data.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
    </header>
  );
}
