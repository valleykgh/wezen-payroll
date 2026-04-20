'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';

type WorkerRequest = {
  id: string;
  status: string;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    startTimeLabel?: string;
    endTimeLabel?: string;
    facilityName: string;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    specialInstructions?: string | null;
  };
};

type SortValue = 'soonest' | 'latest';

export default function WorkerSchedulePage() {
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [message, setMessage] = useState('Loading schedule...');
  const [sortBy, setSortBy] = useState<SortValue>('soonest');

  useEffect(() => {
    async function load() {
      try {
        const me = await apiFetch<{ data: { professionalId?: string | null } }>('/api/auth/me');
        const professionalId = me.data.professionalId;

        if (!professionalId) {
          throw new Error('Professional profile not found.');
        }

        const res = await apiFetch<{ data: WorkerRequest[] }>(
          `/api/worker/requests?professionalId=${professionalId}`
        );

        setRequests(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load schedule');
      }
    }

    load();
  }, []);

  const approvedUpcoming = useMemo(() => {
    const today = new Date(new Date().toDateString()).getTime();

    const items = requests.filter((request) => {
      const shiftDate = new Date(request.shift.date).getTime();
      return request.status === 'APPROVED' && shiftDate >= today;
    });

    items.sort((a, b) => {
      if (sortBy === 'latest') {
        return new Date(b.shift.date).getTime() - new Date(a.shift.date).getTime();
      }

      return new Date(a.shift.date).getTime() - new Date(b.shift.date).getTime();
    });

    return items;
  }, [requests, sortBy]);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Schedule
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Approved shifts and upcoming work
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review your confirmed schedule, facility location, and shift instructions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved upcoming
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {approvedUpcoming.length}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Next shift
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-950">
            {approvedUpcoming[0]
              ? `${approvedUpcoming[0].shift.facilityName} • ${new Date(
                  approvedUpcoming[0].shift.date
                ).toLocaleDateString()}`
              : 'No upcoming shift'}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Sort
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortValue)}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
          >
            <option value="soonest">Soonest first</option>
            <option value="latest">Latest first</option>
          </select>
        </div>
      </div>

      {message && requests.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {approvedUpcoming.length === 0 && !message ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No approved upcoming shifts yet.
        </div>
      ) : null}

      <div className="space-y-4">
        {approvedUpcoming.map((request) => (
          <div
            key={request.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold tracking-tight text-slate-950">
                  {request.shift.role} • {request.shift.shiftType}
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-800">
                  {request.shift.facilityName}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {request.shift.address?.trim()
                    ? request.shift.address
                    : [request.shift.city, request.shift.state].filter(Boolean).join(', ') ||
                      'Location not available'}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {new Date(request.shift.date).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.time}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </div>
                    <div className="mt-1">
                      <StatusBadge label={request.status} tone="success" />
                    </div>
                  </div>
                </div>

                {request.shift.specialInstructions?.trim() ? (
                  <div className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                      Special instructions
                    </div>
                    <div className="mt-1">{request.shift.specialInstructions}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
