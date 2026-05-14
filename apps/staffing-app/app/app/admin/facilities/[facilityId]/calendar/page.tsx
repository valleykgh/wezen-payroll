'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { apiFetch } from '@/lib/api-client';

type Worker = {
  professionalId: string;
  firstName?: string | null;
  lastName?: string | null;
};

type ShiftRow = {
  id: string;
  role: string;
  shiftType: string;
  status: string;
  approvedCount: number;
  pendingCount: number;
  approvedWorkers: Worker[];
  pendingWorkers: Worker[];
};

type CalendarDay = {
  date: string;
  shifts: ShiftRow[];
};

type ResponseData = {
  data: {
    facility: {
      id: string;
      name: string;
    };
    calendar: CalendarDay[];
  };
};

export default function AdminFacilityCalendarPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const today = new Date();

  const defaultMonth =
    String(today.getMonth() + 1).padStart(2, '0');

  const [facilityId, setFacilityId] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(String(today.getFullYear()));

  useEffect(() => {
    async function init() {
      const resolved = await params;
      setFacilityId(resolved.facilityId);
    }

    init();
  }, [params]);

  useEffect(() => {
    if (!facilityId) return;

    async function load() {
      try {
        setLoading(true);

        const res = await apiFetch<ResponseData>(
          `/api/admin/facilities/${facilityId}/calendar?month=${month}&year=${year}`
        );

        setFacilityName(res.data.facility.name);
        setCalendar(res.data.calendar || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [facilityId, month, year]);

  const sorted = useMemo(() => {
    return [...calendar].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [calendar]);

  return (
    <AppShell
      role="admin"
      title="Staffing Calendar"
      subtitle={facilityName || 'Facility staffing overview'}
    >
      <div className="grid gap-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              {Array.from({ length: 12 }).map((_, idx) => {
                const value = String(idx + 1).padStart(2, '0');

                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>

            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <Link
            href="/app/admin/facilities/index.html"
            className="mt-4 inline-flex rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            Back to Facilities
          </Link>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            Loading staffing calendar...
          </div>
        ) : null}

        {sorted.map((day) => (
          <div
            key={day.date}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-extrabold text-slate-950">
              {new Date(day.date).toLocaleDateString()}
            </h2>

            <div className="mt-4 grid gap-3">
              {day.shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-950">
                        {shift.role} • {shift.shiftType}
                      </div>

                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {shift.status}
                      </div>
                    </div>

                    <div className="text-right text-xs">
                      <div className="font-bold text-emerald-700">
                        {shift.approvedCount} approved
                      </div>

                      <div className="font-bold text-amber-700">
                        {shift.pendingCount} pending
                      </div>
                    </div>
                  </div>

                  {shift.approvedWorkers.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                        Approved Workers
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {shift.approvedWorkers.map((worker) => (
                          <div
                            key={worker.professionalId}
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800"
                          >
                            {worker.firstName} {worker.lastName}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {shift.pendingWorkers.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-700">
                        Pending Workers
                      </div>

                      <div className="flex flex-wrap gap-2">
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
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
            No staffing scheduled for this month.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
