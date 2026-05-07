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

export function FacilityScheduleClient() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading schedule...');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('ALL');
  const [shiftType, setShiftType] = useState('ALL');

  useEffect(() => {
    apiFetch<{ data: Shift[] }>('/api/shifts')
      .then((res) => { setShifts(res.data || []); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load schedule'));
  }, []);

  const filtered = useMemo(() => shifts.filter((shift) => {
    const d = shift.date.split('T')[0];
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    if (status !== 'ALL' && shift.status !== status) return false;
    if (shiftType !== 'ALL' && shift.shiftType !== shiftType) return false;
    return true;
  }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [shifts, startDate, endDate, status, shiftType]);

  return (
    <div className="grid gap-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <option value="ALL">All statuses</option><option value="OPEN">Open</option><option value="INVITE_ONLY">Invite only</option><option value="FILLED">Filled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option><option value="UNFILLED">Unfilled</option>
          </select>
          <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <option value="ALL">All shifts</option><option value="AM">AM</option><option value="PM">PM</option><option value="NOC">NOC</option>
          </select>
        </div>
      </section>

      {message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600">{message}</div> : null}

      {filtered.map((shift) => (
        <div key={shift.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{shift.status}</p>
          <h2 className="mt-2 text-lg font-extrabold text-slate-950">{shift.role} • {shift.shiftType}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{new Date(shift.date).toLocaleDateString()} • {shift.time}</p>
          <p className="mt-2 text-xs font-bold text-slate-500">{shift.applicants} applicant(s)</p>
        </div>
      ))}

      {filtered.length === 0 && !message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600">No shifts match the selected filters.</div> : null}
    </div>
  );
}
