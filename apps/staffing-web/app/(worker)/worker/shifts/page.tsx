'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { ShiftResultsClient } from '@/components/worker/shift-results-client';
import { ShiftSearchFilters } from '@/components/worker/shift-search-filters';
import { useSearchParams } from 'next/navigation';

type Shift = {
  id: string;
  role: string;
  facilityId?: string;
  facilityName: string;
  city: string;
  state: string;
  distanceMiles: number | null;
  shiftType: string;
  date: string;
  time: string;
  payRateLabel: string;
  applicants: number;
  workersNeeded: number;
  fillCount: number;
  pendingCount?: number;
  fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED';
  fillLabel: string;
  status: string;
  isBlockedByFacilityDnr?: boolean;
  blockReason?: string | null;
};

export default function WorkerShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading shifts...');
  const searchParams = useSearchParams();

  useEffect(() => {
  async function load() {
    try {
      const query = searchParams.toString();
      const url = query ? `/api/worker/shifts?${query}` : '/api/worker/shifts';

      const res = await apiFetch<{ data: Shift[] }>(url);

      setShifts(res.data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
    }
  }

  load();
}, [searchParams]);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Shift Marketplace
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Search and request available shifts
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Browse open shifts, review facility coverage needs, and request assignments you are eligible to work.
        </p>
      </div>

      <ShiftSearchFilters />

      {message && shifts.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {shifts.length > 0 ? <ShiftResultsClient shifts={shifts} /> : null}
    </div>
  );
}
