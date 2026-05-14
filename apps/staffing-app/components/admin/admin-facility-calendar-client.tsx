'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Worker = {
  professionalId: string;
  firstName?: string | null;
  lastName?: string | null;
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

type CalendarDay = {
  date: string;
  shifts: Shift[];
};

type FacilityCalendarResponse = {
  data: {
    facility: {
      id: string;
      name: string;
    };
    calendar: CalendarDay[];
  };
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function AdminFacilityCalendarClient({
  facilityId,
}: {
  facilityId: string;
}) {
  const today = new Date();

  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [facilityName, setFacilityName] = useState('');
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);

  async function loadCalendar() {
    try {
      setLoading(true);
      setMessage('');

      const res = await apiFetch<FacilityCalendarResponse>(
        `/api/admin/facilities/${facilityId}/calendar?month=${month}&year=${year}`
      );

      setFacilityName(res.data.facility.name);
      setCalendar(res.data.calendar || []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Failed to load calendar'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityId, month, year]);

  const sorted = useMemo(() => {
    return [...calendar].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [calendar]);

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-950">
          {facilityName || 'Facility Calendar'}
        </h1>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2026, i, 1).toLocaleString(undefined, {
                  month: 'long',
                })}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
          />
        </div>
      </div>

      {message ? (
        <div className="rounded-3xl bg-rose-50 p-5 text-sm font-bold text-rose-700 ring-1 ring-rose-200">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          Loading calendar...
        </div>
      ) : null}

      {!loading &&
        sorted.map((day) => (
          <div
            key={day.date}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <h2 className="text-lg font-extrabold text-slate-950">
              {formatDate(day.date)}
            </h2>

            <div className="mt-4 grid gap-4">
              {day.shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-950">
                        {shift.role} • {shift.shiftType}
                      </div>

                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {shift.status}
                      </div>
                    </div>

                    <div className="text-right text-xs font-bold text-slate-500">
                      {shift.approvedCount} approved
                      <br />
                      {shift.pendingCount} pending
                    </div>
                  </div>

                  {shift.approvedWorkers.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                        Approved Workers
                      </div>

                      <div className="grid gap-2">
                        {shift.approvedWorkers.map((worker) => (
                          <div
                            key={worker.professionalId}
                            className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
                          >
                            {worker.firstName} {worker.lastName}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {shift.pendingWorkers.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide text-amber-700">
                        Pending Workers
                      </div>

                      <div className="grid gap-2">
                        {shift.pendingWorkers.map((worker) => (
                          <div
                            key={worker.professionalId}
                            className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800"
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
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          No shifts found for this month.
        </div>
      ) : null}
    </div>
  );
}
