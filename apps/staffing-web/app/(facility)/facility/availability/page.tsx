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
  availabilities: Array<{
    id: string;
    date: string;
    shiftType: ShiftType;
    note?: string | null;
  }>;
};

const shiftTypes: ShiftType[] = ['AM', 'PM', 'NOC'];



function formatDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function FacilityAvailableWorkersPage() {
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
    setSelectedTypes((current) =>
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

  async function searchAvailableWorkers() {
    try {
      setBusy(true);
      setMessage('');
      setSelectedWorkerIds([]);
      setSelectedAvailabilityIds([]);

      if (!startDate) throw new Error('Start date is required.');
      if (selectedTypes.length === 0) throw new Error('Choose at least one shift type.');

      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate || startDate);
      params.set('role', role);
      params.set('shiftTypes', selectedTypes.join(','));
      if (q.trim()) params.set('q', q.trim());

      const res = await apiFetch<{ data: AvailableWorker[] }>(
        `/api/facility/available-workers?${params.toString()}`
      );

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

      if (selectedAvailabilityIds.length === 0) throw new Error('Select at least one availability slot.');

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
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Available Workers
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Search worker availability and send invites
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Find approved workers who marked themselves available for specific dates and shift types.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="CNA">CNA</option>
              <option value="LVN">LVN</option>
              <option value="RN">RN</option>
            </select>
          </div>

          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Shift types</label>
            <div className="grid grid-cols-3 gap-2">
              {shiftTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleShiftType(type)}
                  className={
                    selectedTypes.includes(type)
                      ? 'rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white'
                      : 'rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800'
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Search name or email</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              placeholder="Optional"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={searchAvailableWorkers}
              disabled={busy}
              className="w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </section>

      {workers.length > 0 ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Matching workers</h2>
              <p className="mt-1 text-sm text-slate-600">
                Select exact worker availability slots, then create invite-only shifts and send invitations.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
              <input
                type="number"
                min={1}
                value={workersNeeded}
                onChange={(e) => setWorkersNeeded(Number(e.target.value))}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Workers needed"
              />

              <input
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                placeholder="Optional invite message"
              />

              <button
                type="button"
                onClick={inviteSelectedWorkers}
                disabled={busy || selectedAvailabilityIds.length === 0}
                className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                Invite Selected ({selectedAvailabilityIds.length})
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workers.map((worker) => {
              const name =
                [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
              const selectedCount = worker.availabilities.filter((item) =>
                selectedAvailabilityIds.includes(item.id)
              ).length;

              return (
                <div
                  key={worker.id}
                  className={
                    selectedCount > 0
                      ? 'rounded-3xl border-2 border-cyan-600 bg-cyan-50 p-5 text-left shadow-sm'
                      : 'rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm'
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-slate-950">{name}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{worker.email}</div>
                    </div>

                    <span className={selectedCount > 0 ? 'text-sm font-bold text-cyan-700' : 'text-sm font-bold text-slate-300'}>
                      {selectedCount > 0 ? `${selectedCount} selected` : 'Select slots'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {worker.availabilities.map((item) => {
                      const checked = selectedAvailabilityIds.includes(item.id);

                      return (
                        <label
                          key={item.id}
                          className={
                            checked
                              ? 'flex cursor-pointer items-center justify-between rounded-2xl border border-cyan-300 bg-white px-4 py-3 text-sm font-bold text-cyan-800'
                              : 'flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700'
                          }
                        >
                          <span>{formatDate(item.date)} {item.shiftType}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAvailability(worker.id, item.id)}
                            className="h-4 w-4"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
