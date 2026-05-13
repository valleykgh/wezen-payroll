'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ShiftType = 'AM' | 'PM' | 'NOC';

type AvailabilityRow = {
  id: string;
  date: string;
  shiftType: ShiftType;
};

const shiftTypes: ShiftType[] = ['AM', 'PM', 'NOC'];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(month: string) {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1, 12));
  const end = new Date(Date.UTC(year, m, 0, 12));
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

function daysInMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, m, 0, 12));
  const days: string[] = [];
  for (let day = 1; day <= end.getUTCDate(); day += 1) {
    days.push(toDateInput(new Date(Date.UTC(year, m - 1, day, 12))));
  }
  return days;
}

function labelDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function WorkerAvailabilityClient() {
  const today = new Date();
  const [month, setMonth] = useState(monthValue(today));
  const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK'>('MONTH');
  const [weekStart, setWeekStart] = useState(toDateInput(today));
  const [selected, setSelected] = useState<Record<string, ShiftType[]>>({});
  const [message, setMessage] = useState('Loading availability...');
  const [busy, setBusy] = useState(false);

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeTypes, setRangeTypes] = useState<ShiftType[]>(['AM']);

  const days = useMemo(() => daysInMonth(month), [month]);

  const visibleDays = useMemo(() => {
    if (viewMode === 'MONTH') return days;

    const start = new Date(`${weekStart}T12:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);

    return days.filter((date) => {
      const current = new Date(`${date}T12:00:00.000Z`);
      return current >= start && current <= end;
    });
  }, [days, viewMode, weekStart]);

  async function loadAvailability() {
    try {
      const { startDate, endDate } = monthBounds(month);
      const res = await apiFetch<{ data: AvailabilityRow[] }>(
        `/api/worker/availability?startDate=${startDate}&endDate=${endDate}`
      );

      const next: Record<string, ShiftType[]> = {};
      for (const item of res.data || []) {
        next[item.date] = next[item.date] || [];
        if (!next[item.date].includes(item.shiftType)) next[item.date].push(item.shiftType);
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

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 7000);
    return () => clearTimeout(timer);
  }, [message]);

  function toggleDateShift(date: string, shiftType: ShiftType) {
    setSelected((current) => {
      const currentTypes = current[date] || [];
      const nextTypes = currentTypes.includes(shiftType)
        ? currentTypes.filter((item) => item !== shiftType)
        : [...currentTypes, shiftType];

      const next = { ...current };
      if (nextTypes.length) next[date] = nextTypes;
      else delete next[date];
      return next;
    });
  }

  function toggleRangeType(type: ShiftType) {
    setRangeTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
    );
  }

  function applyRange() {
    if (!rangeStart || !rangeEnd) {
      setMessage('Choose start and end date.');
      return;
    }
    if (!rangeTypes.length) {
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
        next[date] = Array.from(new Set([...(next[date] || []), ...rangeTypes]));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return next;
    });

    setMessage('Range applied. Tap Save to store it.');
  }

  async function saveAvailability() {
    try {
      setBusy(true);
      setMessage('');
      const { startDate, endDate } = monthBounds(month);
      const items = Object.entries(selected).map(([date, shiftTypes]) => ({ date, shiftTypes }));

      await apiFetch('/api/worker/availability', {
        method: 'PUT',
        body: JSON.stringify({ startDate, endDate, items }),
      });

      setMessage('Availability saved.');
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
    setMessage('Month cleared. Tap Save to store it.');
  }

  const selectedCount = Object.values(selected).reduce((sum, types) => sum + types.length, 0);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-cyan-700 bg-cyan-700 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setViewMode('MONTH')} className={viewMode === 'MONTH' ? 'rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white' : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'}>
            Month
          </button>
          <button type="button" onClick={() => setViewMode('WEEK')} className={viewMode === 'WEEK' ? 'rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white' : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'}>
            Week
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          {viewMode === 'WEEK' ? (
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          ) : null}

          <button type="button" onClick={saveAvailability} disabled={busy} className="rounded-2xl bg-cyan-700 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60">
            {busy ? 'Saving...' : `Save Availability (${selectedCount})`}
          </button>
          <button type="button" onClick={clearMonth} disabled={busy} className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60">
            Clear Month
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-lg font-extrabold text-slate-950">Quick Add Range</h3>
        <div className="mt-4 grid gap-3">
          <input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            {shiftTypes.map((type) => (
              <button key={type} type="button" onClick={() => toggleRangeType(type)} className={rangeTypes.includes(type) ? 'rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white' : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'}>
                {type}
              </button>
            ))}
          </div>
          <button type="button" onClick={applyRange} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Apply Range
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {visibleDays.map((date) => {
          const activeTypes = selected[date] || [];
          return (
            <div key={date} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="font-extrabold text-slate-950">{labelDate(date)}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {shiftTypes.map((type) => (
                  <button key={type} type="button" onClick={() => toggleDateShift(date, type)} className={activeTypes.includes(type) ? 'rounded-2xl bg-cyan-700 px-3 py-3 text-xs font-extrabold text-white' : 'rounded-2xl border border-slate-200 px-3 py-3 text-xs font-extrabold text-slate-700'}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3">
          <button
            type="button"
            onClick={saveAvailability}
            disabled={busy}
            className="rounded-2xl bg-cyan-700 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60"
          >
            {busy ? 'Saving...' : `Save Availability (${selectedCount})`}
          </button>

          <button
            type="button"
            onClick={clearMonth}
            disabled={busy}
            className="rounded-2xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-700 disabled:opacity-60"
          >
            Clear Month
          </button>
        </div>
      </div>
    </div>
  );
}
