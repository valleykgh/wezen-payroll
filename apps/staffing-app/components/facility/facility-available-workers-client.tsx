'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ShiftType = 'AM' | 'PM' | 'NOC';
type Role = 'CNA' | 'LVN' | 'RN';

type AvailableWorker = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: Role;
  city?: string | null;
  state?: string | null;
  availableDateCount: number;
  availabilities: Array<{ id: string; date: string; shiftType: ShiftType; note?: string | null }>;
};

const shiftTypes: ShiftType[] = ['AM', 'PM', 'NOC'];

function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function FacilityAvailableWorkersClient() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [role, setRole] = useState<Role>('CNA');
  const [selectedTypes, setSelectedTypes] = useState<ShiftType[]>(['AM']);
  const [q, setQ] = useState('');
  const [workers, setWorkers] = useState<AvailableWorker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [selectedAvailabilityIds, setSelectedAvailabilityIds] = useState<string[]>([]);
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [inviteMessage, setInviteMessage] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function toggleShiftType(type: ShiftType) {
    setSelectedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
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

  async function searchAvailableWorkers() {
    try {
      setBusy(true);
      setMessage('');
      setSelectedWorkerIds([]);
      setSelectedAvailabilityIds([]);

      if (!startDate) throw new Error('Start date is required.');
      if (!selectedTypes.length) throw new Error('Choose at least one shift type.');

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate || startDate);
      params.set('role', role);
      params.set('shiftTypes', selectedTypes.join(','));
      if (q.trim()) params.set('q', q.trim());

      const res = await apiFetch<{ data: AvailableWorker[] }>(`/api/facility/available-workers?${params.toString()}`);
      setWorkers(res.data || []);
      setMessage((res.data || []).length ? '' : 'No workers match this availability search.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to search available workers');
      setWorkers([]);
    } finally {
      setBusy(false);
    }
  }

  async function inviteSelectedWorkers() {
    try {
      setBusy(true);
      setMessage('');

      if (!selectedAvailabilityIds.length) throw new Error('Select at least one availability slot.');

      const res = await apiFetch<{ data: Array<{ shiftId: string }> }>('/api/facility/availability-invitations', {
        method: 'POST',
        body: JSON.stringify({
          startDate,
          endDate: endDate || startDate,
          role,
          shiftTypes: selectedTypes,
          professionalIds: selectedWorkerIds,
          availabilityIds: selectedAvailabilityIds,
          workersNeeded,
          message: inviteMessage || undefined,
        }),
      });

      setMessage(`Invitations sent. ${res.data.length} invite-only shift(s) created.`);
      setSelectedWorkerIds([]);
      setSelectedAvailabilityIds([]);
      setInviteMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to invite workers');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-cyan-700 bg-cyan-700 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3">
          <label className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-3">
            <span className="block text-[10px] font-extrabold uppercase tracking-wide text-cyan-700">Start Date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-950 outline-none" />
          </label>

          <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <span className="block text-[10px] font-extrabold uppercase tracking-wide text-slate-600">End Date Optional</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-950 outline-none" />
          </label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <option value="CNA">CNA</option>
            <option value="LVN">LVN</option>
            <option value="RN">RN</option>
          </select>
          <div className="grid grid-cols-3 gap-2">
            {shiftTypes.map((type) => (
              <button key={type} type="button" onClick={() => toggleShiftType(type)} className={selectedTypes.includes(type) ? 'rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white' : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'}>
                {type}
              </button>
            ))}
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <button type="button" onClick={searchAvailableWorkers} disabled={busy} className="rounded-2xl bg-cyan-700 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60">
            {busy ? 'Searching...' : 'Search Available Workers'}
          </button>
        </div>
      </div>

      {workers.length > 0 ? (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="grid gap-3">
            <input type="number" min={1} value={workersNeeded} onChange={(e) => setWorkersNeeded(Number(e.target.value))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <input value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Optional invite message" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
            <button type="button" onClick={inviteSelectedWorkers} disabled={busy || selectedAvailabilityIds.length === 0} className="rounded-2xl bg-slate-950 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60">
              Invite Selected ({selectedAvailabilityIds.length})
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {workers.map((worker) => {
          const name = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
          const selectedCount = worker.availabilities.filter((item) => selectedAvailabilityIds.includes(item.id)).length;

          return (
            <div key={worker.id} className={selectedCount > 0 ? 'rounded-3xl border-2 border-cyan-700 bg-cyan-50 p-5 text-left shadow-sm' : 'rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-slate-950">{name}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-600">{worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">{worker.email}</div>
                </div>
                <span className={selectedCount > 0 ? 'text-xs font-extrabold text-cyan-700' : 'text-xs font-extrabold text-slate-300'}>
                  {selectedCount > 0 ? `${selectedCount} selected` : 'Select slots'}
                </span>
              </div>

              <div className="mt-4 grid gap-2">
                {worker.availabilities.map((item) => {
                  const checked = selectedAvailabilityIds.includes(item.id);

                  return (
                    <label key={item.id} className={checked ? 'flex items-center justify-between rounded-2xl border border-cyan-300 bg-white px-4 py-3 text-sm font-extrabold text-cyan-800' : 'flex items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-sm font-extrabold text-slate-700'}>
                      <span>{formatDate(item.date)} {item.shiftType}</span>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
