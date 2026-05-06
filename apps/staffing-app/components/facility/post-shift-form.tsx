'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

function formatTimeLabel(value: string) {
  const raw = value.trim().toLowerCase();

  if (!raw) return '';

  if (raw.includes('am') || raw.includes('pm')) {
    return raw.replace(/\s+/g, ' ').toUpperCase();
  }

  let hour = 0;
  let minute = 0;

  if (raw.includes(':')) {
    const [h, m] = raw.split(':');
    hour = Number(h);
    minute = Number(m || 0);
  } else {
    hour = Number(raw);
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const minuteLabel = String(minute).padStart(2, '0');

  return `${hour12}:${minuteLabel} ${suffix}`;
}

export function PostShiftForm() {
  const [role, setRole] = useState('CNA');
  const [shiftType, setShiftType] = useState('AM');
  const [date, setDate] = useState('');
  const [startTimeLabel, setStartTimeLabel] = useState('');
  const [endTimeLabel, setEndTimeLabel] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {

	const me = await apiFetch<{ data: { facilityId?: string | null } }>('/api/auth/me');

await apiFetch('/api/shifts', {
  method: 'POST',
  body: JSON.stringify({
    facilityId: me.data.facilityId,
    role,
    shiftType,
    date,
    startTimeLabel: formatTimeLabel(startTimeLabel),
    endTimeLabel: formatTimeLabel(endTimeLabel),
    workersNeeded,
    specialInstructions,
  }),
});
	
      setMessage('✅ Success! Shift posted successfully. Nearby eligible workers are being notified.');
      setDate('');
      setStartTimeLabel('');
      setEndTimeLabel('');
      setWorkersNeeded(1);
      setSpecialInstructions('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to post shift');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);



  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-950">Post a Shift</h2>

      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-xl font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
            <option value="CNA">CNA</option>
            <option value="LVN">LVN</option>
            <option value="RN">RN</option>
          </select>

          <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="NOC">NOC</option>
          </select>
        </div>

        <div className="grid gap-1">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Shift date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-4 text-base font-semibold text-slate-950"
          />
          <p className="text-xs text-slate-500">Tap to open calendar</p>
        </div>

        <input
          placeholder="Start time: 7 or 7:00 or 15:30"
          value={startTimeLabel}
          onChange={(e) => setStartTimeLabel(e.target.value)}
          onBlur={(e) => setStartTimeLabel(formatTimeLabel(e.target.value))}
          required
          className="rounded-2xl border border-slate-200 px-3 py-3 text-sm"
        />

        <input
          placeholder="End time: 15:30 or 3:30 PM"
          value={endTimeLabel}
          onChange={(e) => setEndTimeLabel(e.target.value)}
          onBlur={(e) => setEndTimeLabel(formatTimeLabel(e.target.value))}
          required
          className="rounded-2xl border border-slate-200 px-3 py-3 text-sm"
        />

        <input type="number" min={1} value={workersNeeded} onChange={(e) => setWorkersNeeded(Number(e.target.value))} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <textarea placeholder="Special instructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="min-h-24 rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <button type="submit" disabled={loading} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? 'Posting...' : 'Post Shift'}
        </button>
      </div>
    </form>
  );
}
