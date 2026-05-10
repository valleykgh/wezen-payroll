'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type WorkerSearchResult = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  city?: string | null;
  state?: string | null;
  availableDateCount?: number;
  availabilities?: Array<{
    id: string;
    date: string;
    shiftType: string;
    note?: string | null;
  }>;
};

function formatAvailabilityDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';

  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    const hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || 0);
    const suffix = ampmMatch[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return value;
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
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
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function PostShiftForm() {
  const [role, setRole] = useState('CNA');
  const [shiftTypes, setShiftTypes] = useState<string[]>(['AM']);
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [inviteMode, setInviteMode] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workers, setWorkers] = useState<WorkerSearchResult[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const inviteSectionRef = useRef<HTMLDivElement | null>(null);

  async function createShift(visibility: 'PUBLIC' | 'INVITE_ONLY') {
    setLoading(true);
    setMessage('');

    try {
      if (shiftTypes.length === 0) {
        throw new Error('Select at least one shift type.');
      }

      const me = await apiFetch<{ data: { facilityId?: string | null } }>('/api/auth/me');
      let firstCreatedShiftId = '';

      const datesToCreate = getDateRange(date, endDate);

      for (const currentDate of datesToCreate) {
        for (const currentShiftType of shiftTypes) {
        const res = await apiFetch<{ data: { id: string } }>('/api/shifts', {
          method: 'POST',
          body: JSON.stringify({
            facilityId: me.data.facilityId,
            role,
            shiftType: currentShiftType,
            date: currentDate,
            workersNeeded,
            specialInstructions,
            visibility,
          }),
        });

        if (!firstCreatedShiftId) firstCreatedShiftId = res.data.id;
        }
      }

      if (visibility === 'INVITE_ONLY') {
        setInviteMode(true);
        setMessage('Search and select workers. The shift will only be created after you press Send Invite.');
        await searchWorkers();
        return;
      }

      setMessage(`✅ Success! ${shiftTypes.length} shift${shiftTypes.length === 1 ? '' : 's'} posted successfully.`);
      setDate('');
      setEndDate('');
      setWorkersNeeded(1);
      setSpecialInstructions('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to post shift');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createShift('PUBLIC');
  }

  async function searchWorkers() {
    const params = new URLSearchParams();
    params.set('role', role);
    if (workerSearch.trim()) params.set('q', workerSearch.trim());

    if (!date) {
      throw new Error('Please select a start date before searching available workers.');
    }

    params.set('startDate', date);
    params.set('endDate', endDate || date);
    params.set('shiftTypes', Array.isArray(shiftTypes) ? shiftTypes.join(',') : String(shiftTypes));

    const res = await apiFetch<{ data: WorkerSearchResult[] }>(
      `/api/facility/available-workers?${params.toString()}`
    );
    setWorkers(res.data || []);
  }

  function toggleShiftType(type: string) {
    setShiftTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  }

  function toggleAvailability(workerId: string, availabilityId: string) {
    setSelectedAvailabilityIds((current) =>
      current.includes(availabilityId)
        ? current.filter((id) => id !== availabilityId)
        : [...current, availabilityId]
    );

    setSelectedWorkerIds((current) =>
      current.includes(workerId) ? current : [...current, workerId]
    );
  }

  async function inviteSelectedWorkers() {
    try {
      if (selectedAvailabilityIds.length === 0) throw new Error('Select at least one availability slot.');
      if (!date) throw new Error('Start date is required.');
      if (shiftTypes.length === 0) throw new Error('Select at least one shift type.');

      setLoading(true);
      setMessage('');

      const res = await apiFetch<{ data: Array<{ shiftId: string }> }>('/api/facility/availability-invitations', {
        method: 'POST',
        body: JSON.stringify({
          startDate: date,
          endDate: endDate || date,
          role,
          shiftTypes,
          professionalIds: selectedWorkerIds,
          availabilityIds: selectedAvailabilityIds,
          workersNeeded,
          message: inviteMessage || undefined,
        }),
      });

      setMessage(`✅ Invitations sent. ${res.data.length} invite-only shift${res.data.length === 1 ? '' : 's'} created.`);
      setInviteMode(false);
      setWorkers([]);
      setSelectedWorkerIds([]);
      setSelectedAvailabilityIds([]);
      setInviteMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!inviteMode) return;
    setTimeout(() => {
      inviteSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
  }, [inviteMode]);

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

          <div className="grid grid-cols-3 gap-2">
            {['AM', 'PM', 'NOC'].map((type) => {
              const active = shiftTypes.includes(type);

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleShiftType(type)}
                  className={
                    active
                      ? 'rounded-2xl bg-cyan-600 px-3 py-3 text-sm font-bold text-white'
                      : 'rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700'
                  }
                >
                  {type}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="rounded-2xl border border-cyan-300 bg-cyan-50 px-3 py-3">
            <span className="block text-[10px] font-extrabold uppercase tracking-wide text-cyan-700">Start Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-950 outline-none" />
          </label>

          <label className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-600">End Date Optional</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-950 outline-none" />
          </label>
        </div>

                <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-900">
          Shift times will use facility defaults for the selected AM / PM / NOC shift types.
        </div>

<input type="number" min={1} value={workersNeeded} onChange={(e) => setWorkersNeeded(Number(e.target.value))} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <textarea placeholder="Special instructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="min-h-24 rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <button type="submit" disabled={loading} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? 'Posting...' : 'Post Shift Publicly'}
        </button>

        <button
          type="button"
          onClick={async () => {
            setInviteMode(true);
            setMessage('Search and select workers. The shift will only be created after you press Send Invite.');
            await searchWorkers();
          }}
          disabled={loading || !date}
          className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? 'Working...' : 'Invite Workers First'}
        </button>
      </div>

      {inviteMode ? (
        <div ref={inviteSectionRef} className="mt-5 rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
          <h3 className="text-base font-extrabold text-slate-950">Invite workers</h3>
          <p className="mt-1 text-xs text-slate-600">No shift is created until you press Send Invite.</p>

          <input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="Search name or email" className="mt-3 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm" />

          <button type="button" onClick={searchWorkers} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Search Workers
          </button>

          <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Optional invite message" className="mt-3 min-h-20 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm" />

          <div className="mt-3 grid gap-3">
            {workers.map((worker) => {
              const fullName = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
              const selectedCount = (worker.availabilities || []).filter((item) => selectedAvailabilityIds.includes(item.id)).length;

              return (
                <div key={worker.id} className={selectedCount > 0 ? 'rounded-2xl border-2 border-cyan-700 bg-white p-4 text-left' : 'rounded-2xl border border-cyan-200 bg-white p-4 text-left'}>
                  <p className="text-sm font-bold text-slate-950">{fullName}</p>
                  <p className="mt-1 text-xs text-slate-600">{worker.email}</p>
                  <p className="mt-2 text-xs font-bold text-cyan-800">{worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}</p>
                  {worker.availabilities && worker.availabilities.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      <span className="w-full text-xs font-extrabold text-emerald-700">Select availability:</span>
                      {worker.availabilities.map((item) => {
                        const checked = selectedAvailabilityIds.includes(item.id);
                        return (
                          <label
                            key={`${worker.id}-${item.id}`}
                            className={checked ? 'flex items-center justify-between rounded-2xl border border-cyan-300 bg-cyan-50 px-3 py-3 text-xs font-extrabold text-cyan-800' : 'flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-3 text-xs font-extrabold text-emerald-700'}
                          >
                            <span>{formatAvailabilityDate(item.date)} {item.shiftType}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAvailability(worker.id, item.id)}
                              className="h-5 w-5"
                            />
                          </label>
                        );
                      })}
                    </div>
                  ) : date ? (
                    <p className="mt-3 text-xs font-bold text-amber-700">
                      No matching availability found for selected date/shift.
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs font-extrabold text-slate-500">{selectedCount > 0 ? `${selectedCount} selected` : 'Select one or more slots'}</p>
                </div>
              );
            })}
          </div>

          <button type="button" onClick={inviteSelectedWorkers} disabled={loading || selectedAvailabilityIds.length === 0} className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            Send Invite{selectedAvailabilityIds.length ? ` (${selectedAvailabilityIds.length})` : ''}
          </button>
        </div>
      ) : null}
    </form>
  );
}


function getDateRange(startDate: string, endDate?: string) {
  if (!startDate) return [];

  const start = new Date(`${startDate}T12:00:00.000Z`);
  const end = endDate ? new Date(`${endDate}T12:00:00.000Z`) : start;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [startDate];
  }

  if (end < start) {
    return [startDate];
  }

  const dates: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
