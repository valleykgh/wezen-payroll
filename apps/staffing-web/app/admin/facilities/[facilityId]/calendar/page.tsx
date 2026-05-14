'use client';

import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Worker = {
  professionalId: string;
  firstName: string;
  lastName: string;
};

type Shift = {
  id: string;
  role: string;
  shiftType: string;
  status: string;
  approvedWorkers: Worker[];
  pendingWorkers: Worker[];
  approvedCount: number;
  pendingCount: number;
};

type DayGroup = {
  date: string;
  shifts: Shift[];
};

type CalendarResponse = {
  data: {
    facility: {
      id: string;
      name: string;
    };
    calendar: DayGroup[];
  };
};

export default function FacilityCalendarPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const resolved = use(params);
  const facilityId = resolved.facilityId;

  const today = new Date();

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [facilityName, setFacilityName] = useState('');
  const [calendar, setCalendar] = useState<DayGroup[]>([]);

  async function loadCalendar() {
    try {
      setLoading(true);
      setMessage('');

      const res = await apiFetch<CalendarResponse>(
        `/api/admin/facilities/${facilityId}/calendar?month=${month}&year=${year}`
      );

      setFacilityName(res.data.facility.name);
      setCalendar(res.data.calendar || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load facility calendar'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendar();
  }, [month, year]);

  const sorted = useMemo(() => {
    return [...calendar].sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [calendar]);

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-cyan-50 to-white p-6 border border-slate-200">
        <Link
          href={`/admin/facilities/${facilityId}`}
          className="text-sm font-semibold text-cyan-700"
        >
          ← Back to Facility
        </Link>

        <h1 className="mt-4 text-3xl font-bold text-slate-950">
          Staffing Calendar
        </h1>

        <p className="mt-2 text-slate-600">
          {facilityName || 'Facility'} staffing schedule overview.
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
          Loading calendar...
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-6">
        {sorted.map((day) => (
          <div
            key={day.date}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="text-xl font-bold text-slate-950">
              {new Date(day.date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {day.shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold text-slate-950">
                      {shift.shiftType}
                    </div>

                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {shift.status}
                    </div>
                  </div>

                  <div className="mt-2 text-sm font-semibold text-slate-700">
                    {shift.role}
                  </div>

                  <div className="mt-4">
                    {shift.approvedWorkers.length === 0 ? (
                      <div className="text-sm font-bold text-rose-600">
                        OPEN
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Approved
                        </div>

                        <div className="mt-2 space-y-1">
                          {shift.approvedWorkers.map((worker) => (
                            <div
                              key={worker.professionalId}
                              className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                            >
                              {worker.firstName} {worker.lastName}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {shift.pendingWorkers.length > 0 ? (
                    <div className="mt-4">
                      <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
                        Pending
                      </div>

                      <div className="mt-2 space-y-1">
                        {shift.pendingWorkers.map((worker) => (
                          <div
                            key={worker.professionalId}
                            className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800"
                          >
                            {worker.firstName} {worker.lastName}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && sorted.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            No shifts found for this month.
          </div>
        ) : null}
      </div>
    </div>
  );
}
