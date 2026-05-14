'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ShiftType = 'AM' | 'PM' | 'NOC';

type AvailabilityRow = {
  id: string;
  date: string;
  shiftType: ShiftType;
  note?: string | null;
};

const shiftTypes: ShiftType[] = ['AM', 'PM', 'NOC'];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthBounds(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 12));
  const end = new Date(Date.UTC(year, month, 0, 12));
  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function daysInMonth(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number);
  const end = new Date(Date.UTC(year, month, 0, 12));
  const days: string[] = [];

  for (let day = 1; day <= end.getUTCDate(); day += 1) {
    days.push(toDateInput(new Date(Date.UTC(year, month - 1, day, 12))));
  }

  return days;
}

function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function WorkerAvailabilityPage() {
  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [weekStart, setWeekStart] = useState(toDateInput(today));
  const [selected, setSelected] = useState<Record<string, ShiftType[]>>({});
  const [message, setMessage] = useState('Loading availability...');
  const [busy, setBusy] = useState(false);

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeTypes, setRangeTypes] = useState<ShiftType[]>(['AM']);

  const days = useMemo(() => daysInMonth(month), [month]);

  async function loadAvailability() {
    try {
      setMessage('Loading availability...');
      const { startDate, endDate } = monthBounds(month);
      const res = await apiFetch<{ data: AvailabilityRow[] }>(
        `/api/worker/availability?startDate=${startDate}&endDate=${endDate}`
      );

      const next: Record<string, ShiftType[]> = {};

      for (const item of res.data || []) {
        next[item.date] = next[item.date] || [];
        if (!next[item.date].includes(item.shiftType)) {
          next[item.date].push(item.shiftType);
        }
      }

      setSelected(next);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load availability');
    }
  }

  useEffect(() => {
    loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  function toggleDateShift(date: string, shiftType: ShiftType) {
    setSelected((current) => {
      const currentTypes = current[date] || [];
      const nextTypes = currentTypes.includes(shiftType)
        ? currentTypes.filter((item) => item !== shiftType)
        : [...currentTypes, shiftType];

      const next = { ...current };

      if (nextTypes.length === 0) {
        delete next[date];
      } else {
        next[date] = nextTypes;
      }

      return next;
    });
  }

  function toggleRangeType(type: ShiftType) {
    setRangeTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  }

  function applyRange() {
    if (!rangeStart || !rangeEnd) {
      setMessage('Choose a start date and end date.');
      return;
    }

    if (rangeTypes.length === 0) {
      setMessage('Choose at least one shift type.');
      return;
    }

    const start = new Date(`${rangeStart}T12:00:00.000Z`);
    const end = new Date(`${rangeEnd}T12:00:00.000Z`);

    if (end < start) {
      setMessage('End date must be after start date.');
      return;
    }

    setSelected((current) => {
      const next = { ...current };
      const cursor = new Date(start);

      while (cursor <= end) {
        const date = toDateInput(cursor);
        const existing = next[date] || [];
        next[date] = Array.from(new Set([...existing, ...rangeTypes]));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return next;
    });

    setMessage('Range applied. Click Save Availability to store it.');
  }

  async function saveAvailability() {
    try {
      setBusy(true);
      setMessage('');

      const { startDate, endDate } = monthBounds(month);
      const items = Object.entries(selected).map(([date, shiftTypes]) => ({
        date,
        shiftTypes,
      }));

      await apiFetch('/api/worker/availability', {
        method: 'PUT',
        body: JSON.stringify({
          startDate,
          endDate,
          items,
        }),
      });

      setMessage('Availability saved successfully.');
      await loadAvailability();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save availability');
    } finally {
      setBusy(false);
    }
  }

  function clearMonth() {
    if (!window.confirm('Clear all availability for this month?')) return;
    setSelected({});
    setMessage('Month cleared. Click Save Availability to store it.');
  }

  const selectedCount = Object.values(selected).reduce((sum, types) => sum + types.length, 0);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Availability Calendar
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Tell facilities when you are available
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Select AM, PM, or NOC for each day. You can choose multiple shift types on the same day.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setViewMode('MONTH')}
            className={viewMode === 'MONTH' ? 'rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white' : 'rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800'}
          >
            Month View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('WEEK')}
            className={viewMode === 'WEEK' ? 'rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white' : 'rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800'}
          >
            Week View
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          {viewMode === 'WEEK' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Week starting</label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={saveAvailability}
            disabled={busy}
            className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Saving...' : `Save Availability (${selectedCount})`}
          </button>

          <button
            type="button"
            onClick={clearMonth}
            disabled={busy}
            className="rounded-full border border-rose-300 px-6 py-3 text-sm font-bold text-rose-700 disabled:opacity-60"
          >
            Clear Month
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Quick add date range</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Shift types</label>
            <div className="grid grid-cols-3 gap-2">
              {shiftTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleRangeType(type)}
                  className={
                    rangeTypes.includes(type)
                      ? 'rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white'
                      : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={applyRange}
          className="mt-5 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white"
        >
          Apply Range
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">
          {viewMode === 'WEEK' ? 'Week view' : 'Month view'}
        </h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(viewMode === 'WEEK' ? days.filter((date) => {
            const start = new Date(`${weekStart}T12:00:00.000Z`);
            const end = new Date(start);
            end.setUTCDate(end.getUTCDate() + 6);
            const current = new Date(`${date}T12:00:00.000Z`);
            return current >= start && current <= end;
          }) : days).map((date) => {
            const activeTypes = selected[date] || [];

            return (
              <div key={date} className="rounded-2xl border border-slate-200 p-4">
                <div className="font-bold text-slate-950">{formatDate(date)}</div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {shiftTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleDateShift(date, type)}
                      className={
                        activeTypes.includes(type)
                          ? 'rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white'
                          : 'rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700'
                      }
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={saveAvailability}
          disabled={busy}
          className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
        >
          {busy ? 'Saving...' : `Save Availability (${selectedCount})`}
        </button>

        <button
          type="button"
          onClick={clearMonth}
          disabled={busy}
          className="rounded-full border border-rose-300 px-6 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          Clear Month
        </button>
      </div>
    </div>
  );
}
