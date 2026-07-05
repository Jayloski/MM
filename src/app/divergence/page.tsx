'use client';

import Navbar from '@/components/Navbar';
import DivergenceScanner from '@/components/DivergenceScanner';
import { useCorrelationData } from '@/hooks/useCorrelationData';

export default function DivergencePage() {
  const { data: corrData } = useCorrelationData();

  return (
    <div className="min-h-screen bg-surface text-slate-200">
      <Navbar data={corrData} />
      <main className="mx-auto max-w-screen-2xl space-y-6 px-4 py-6">
        <DivergenceScanner />
      </main>
    </div>
  );
}
