'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type AvailabilityRow = {
  id: string;
  date: string;
  shiftType: string;
};

type WorkerAvailabilityResponse = {
  data: AvailabilityRow[];
};

export default function WorkerAvailabilityPage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const resolved = use(params);
  const professionalId = resolved.professionalId;

  const today = new Date();

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [rows, setRows] = useState<AvailabilityRow[]>([]);

  async function loadAvailability() {
    try {
      setLoading(true);
      setMessage('');

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

      const res = await apiFetch<WorkerAvailabilityResponse>(
        `/api/admin/workers/${professionalId}/availability?startDate=${startDate}&endDate=${endDate}`
      );

      setRows(res.data || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load availability'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, [month, year]);

  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};

    for (const row of rows) {
      map[row.date] = map[row.date] || [];
      map[row.date].push(row.shiftType);
    }

    return Object.entries(map).sort((a, b) =>
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [rows]);

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href={`/admin/workers/${professionalId}`}
          className="text-sm font-semibold text-cyan-700"
        >
          ← Back to Worker
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-950">
          Worker Availability Calendar
        </h1>

        <p className="mt-2 text-slate-600">
          Review worker availability by shift type.
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Month
            </label>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2026, i, 1).toLocaleString(undefined, {
                    month: 'long',
                  })}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Year
            </label>

            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-slate-600">
          Loading availability...
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([date, shifts]) => (
          <div
            key={date}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="text-lg font-bold text-slate-950">
              {new Date(date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {shifts.map((shift) => (
                <div
                  key={`${date}-${shift}`}
                  className="rounded-full bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-800"
                >
                  {shift}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!loading && grouped.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-slate-600">
          No availability found for this month.
        </div>
      ) : null}
    </div>
  );
}
