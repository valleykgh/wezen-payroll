'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Shift = {
  id: string;
  role: string;
  shiftType: string;
  date: string;
  time: string;
  status: string;
  applicants: number;
};

export default function FacilitySchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading schedule...');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftTypeFilter, setShiftTypeFilter] = useState('ALL');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Shift[] }>('/api/shifts');
        setShifts(res.data);
        setMessage('');
      } catch (e) {
        setMessage('Failed to load schedule');
      }
    }

    load();
  }, []);

  const filteredShifts = useMemo(() => {
    return shifts
      .filter((shift) => {
        const dateOnly = shift.date.split('T')[0];

        if (startDate && dateOnly < startDate) return false;
        if (endDate && dateOnly > endDate) return false;
        if (statusFilter !== 'ALL' && shift.status !== statusFilter) return false;
        if (shiftTypeFilter !== 'ALL' && shift.shiftType !== shiftTypeFilter) return false;

        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [shifts, startDate, endDate, statusFilter, shiftTypeFilter]);

  const grouped = filteredShifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    const date = new Date(shift.date).toDateString();
    acc[date] = acc[date] || [];
    acc[date].push(shift);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <h1 className="text-3xl font-bold text-slate-950">
          Staffing Schedule
        </h1>
        <p className="mt-2 text-slate-600">
          View and manage your upcoming shifts.
        </p>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="INVITE_ONLY">Invite only</option>
              <option value="FILLED">Filled</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="UNFILLED">Unfilled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shift type</label>
            <select
              value={shiftTypeFilter}
              onChange={(e) => setShiftTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="ALL">All shifts</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="NOC">NOC</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setStatusFilter('ALL');
              setShiftTypeFilter('ALL');
            }}
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900"
          >
            Clear filters
          </button>
        </div>
      </div>

      {message && <div>{message}</div>}

      <div className="space-y-6">
        {Object.keys(grouped).length === 0 && !message ? (
          <div className="rounded-2xl border bg-white p-6 text-slate-600">
            No shifts match the selected filters.
          </div>
        ) : null}

        {Object.entries(grouped).map(([date, shifts]) => (
          <div key={date} className="rounded-2xl border bg-white p-6">
            <div className="text-lg font-bold">{date}</div>

            <div className="mt-4 space-y-3">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <div className="font-semibold">
                      {shift.role} • {shift.shiftType}
                    </div>
                    <div className="text-sm text-slate-600">
                      {shift.time}
                    </div>
                  </div>

                  <div className="text-sm text-slate-500">
                    {shift.applicants} applicants
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
