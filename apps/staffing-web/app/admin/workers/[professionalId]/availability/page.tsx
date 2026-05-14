'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

type AvailabilityRow = {
  id: string;
  date: string;
  shiftType: 'AM' | 'PM' | 'NOC';
};

type WorkerAvailabilityResponse = {
  professional: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    role?: string | null;
  };
  availability: AvailabilityRow[];
};

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(month: string) {
  const [year, m] = month.split('-').map(Number);

  const start = `${year}-${String(m).padStart(2, '0')}-01`;

  const endDate = new Date(year, m, 0);

  const end = `${year}-${String(m).padStart(2, '0')}-${String(
    endDate.getDate()
  ).padStart(2, '0')}`;

  return { start, end };
}

function daysInMonth(month: string) {
  const [year, m] = month.split('-').map(Number);

  const last = new Date(year, m, 0).getDate();

  return Array.from({ length: last }, (_, i) => {
    return `${year}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
  });
}

function labelDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);

  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminWorkerAvailabilityPage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const today = new Date();

  const [professionalId, setProfessionalId] = useState('');
  const [month, setMonth] = useState(monthValue(today));
  const [data, setData] = useState<WorkerAvailabilityResponse | null>(null);
  const [message, setMessage] = useState('Loading availability...');

  const days = useMemo(() => daysInMonth(month), [month]);

  useEffect(() => {
    async function load() {
      try {
        const resolved = await params;

        setProfessionalId(resolved.professionalId);

        const [year, monthNum] = month.split('-');

        const res = await apiFetch<{ data: WorkerAvailabilityResponse }>(
          `/api/admin/workers/${resolved.professionalId}/availability?startDate=${year}-${monthNum}-01&endDate=${monthBounds(month).end}`
        );

        setData(res.data);
        setMessage('');
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : 'Failed to load worker availability'
        );
      }
    }

    load();
  }, [params, month]);

  const selected: Record<string, string[]> = {};

  for (const item of data?.availability || []) {
    selected[item.date] = selected[item.date] || [];
    selected[item.date].push(item.shiftType);
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Worker Availability
            </div>

            <h1 className="mt-3 text-4xl font-bold tracking-tight">
              {data?.professional.firstName} {data?.professional.lastName}
            </h1>

            <p className="mt-2 text-slate-200">
              {data?.professional.role} • {data?.professional.email}
            </p>
          </div>

          <Link
            href={`/admin/workers/${professionalId}`}
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Back to Worker
          </Link>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Month
            </label>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((date) => {
          const activeTypes = selected[date] || [];

          return (
            <div
              key={date}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="font-bold text-slate-950">
                {labelDate(date)}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {['AM', 'PM', 'NOC'].map((type) => (
                  <div
                    key={type}
                    className={
                      activeTypes.includes(type)
                        ? 'rounded-xl bg-cyan-600 px-3 py-2 text-center text-xs font-bold text-white'
                        : 'rounded-xl border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-400'
                    }
                  >
                    {type}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
